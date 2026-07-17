using System.Net;
using System.Text.Json;
using System.Linq;
using Azure;
using Azure.Data.Tables;
using Azure.Identity;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;

namespace Asteroids.Api;

public class LeaderboardFunctions(ILoggerFactory loggerFactory)
{
    private readonly ILogger _logger = loggerFactory.CreateLogger<LeaderboardFunctions>();
    private const string TableName = "AsteroidsLeaderboard";

    private static TableServiceClient GetTableServiceClient()
    {
        var connectionString = Environment.GetEnvironmentVariable("TableStorageConnectionString");
        if (!string.IsNullOrEmpty(connectionString) && connectionString != "UseManagedIdentity")
        {
            return new TableServiceClient(connectionString);
        }

        var storageUri = Environment.GetEnvironmentVariable("TableStorageUri");
        if (!string.IsNullOrEmpty(storageUri))
        {
            return new TableServiceClient(new Uri(storageUri), new DefaultAzureCredential());
        }

        var devStorage = Environment.GetEnvironmentVariable("AzureWebJobsStorage");
        return new TableServiceClient(string.IsNullOrEmpty(devStorage) ? "UseDevelopmentStorage=true" : devStorage);
    }

    [Function("GetLeaderboard")]
    public async Task<HttpResponseData> GetLeaderboard(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard")] HttpRequestData req)
    {
        _logger.LogInformation("Fetching leaderboard scores.");
        var response = req.CreateResponse();

        try
        {
            var serviceClient = GetTableServiceClient();
            var tableClient = serviceClient.GetTableClient(TableName);
            await tableClient.CreateIfNotExistsAsync();

            var scores = new List<ScoreDto>();
            var queryResults = tableClient.QueryAsync<TableEntity>(filter: "PartitionKey eq 'Score'");

            await foreach (var entity in queryResults)
            {
                scores.Add(new ScoreDto
                {
                    Username = entity.GetString("Username") ?? "Unknown",
                    Score = entity.GetInt32("Score") ?? 0,
                    SurvivalTime = entity.GetDouble("SurvivalTime") ?? 0,
                    PlayedAt = entity.GetString("PlayedAt") ?? entity.Timestamp?.ToString("o") ?? string.Empty
                });
            }

            var sortedScores = scores
                .OrderByDescending(s => s.Score)
                .ThenByDescending(s => s.SurvivalTime)
                .Take(10)
                .ToList();

            response.StatusCode = HttpStatusCode.OK;
            await response.WriteAsJsonAsync(sortedScores);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching leaderboard.");
            response.StatusCode = HttpStatusCode.InternalServerError;
            await response.WriteStringAsync("Error retrieving leaderboard data.");
        }

        return response;
    }

    private static string GenerateRandomCode()
    {
        const string chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; // Omit confusing I, L, 1, 0, O
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 6)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    [Function("RegisterUser")]
    public async Task<HttpResponseData> RegisterUser(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "register")] HttpRequestData req)
    {
        _logger.LogInformation("Attempting to register a username.");
        var response = req.CreateResponse();

        try
        {
            var body = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(body))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("Request body is empty.");
                return response;
            }

            var payload = JsonSerializer.Deserialize<RegisterDto>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            var rawUsername = payload?.Username;
            var clientCode = payload?.RecoveryCode?.Trim().ToUpperInvariant();

            if (string.IsNullOrWhiteSpace(rawUsername))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("Username is required.");
                return response;
            }

            var cleanedUsername = new string(rawUsername.Trim().Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-').ToArray());
            if (cleanedUsername.Length > 20)
            {
                cleanedUsername = cleanedUsername.Substring(0, 20);
            }

            if (string.IsNullOrWhiteSpace(cleanedUsername) || cleanedUsername.Length < 3)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("Username must be at least 3 alphanumeric characters.");
                return response;
            }

            var normalizedUsername = cleanedUsername.ToLowerInvariant();

            var serviceClient = GetTableServiceClient();
            var tableClient = serviceClient.GetTableClient(TableName);
            await tableClient.CreateIfNotExistsAsync();

            TableEntity? existingUser = null;
            try
            {
                var existingResult = await tableClient.GetEntityAsync<TableEntity>("User", normalizedUsername);
                existingUser = existingResult.Value;
            }
            catch (RequestFailedException ex) when (ex.Status == (int)HttpStatusCode.NotFound)
            {
                // User does not exist, which is fine!
            }

            if (existingUser == null)
            {
                // Create new user
                var recoveryCode = GenerateRandomCode();
                var userEntity = new TableEntity("User", normalizedUsername)
                {
                    { "ClaimedAt", DateTimeOffset.UtcNow },
                    { "DisplayName", cleanedUsername },
                    { "RecoveryCode", recoveryCode },
                    { "CanBeReclaimed", false }
                };

                await tableClient.AddEntityAsync(userEntity);
                _logger.LogInformation("Username '{Username}' registered as new with RecoveryCode '{Code}'.", cleanedUsername, recoveryCode);

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { Username = cleanedUsername, RecoveryCode = recoveryCode });
            }
            else
            {
                // User exists!
                var canBeReclaimed = existingUser.GetBoolean("CanBeReclaimed") ?? false;
                var dbCode = existingUser.GetString("RecoveryCode") ?? string.Empty;

                if (canBeReclaimed)
                {
                    // Case A: User has flagged the account as Reclaimable. Overwrite it with a fresh code.
                    var newRecoveryCode = GenerateRandomCode();
                    
                    existingUser["ClaimedAt"] = DateTimeOffset.UtcNow;
                    existingUser["DisplayName"] = cleanedUsername;
                    existingUser["RecoveryCode"] = newRecoveryCode;
                    existingUser["CanBeReclaimed"] = false; // Reset the flag back to false for security

                    await tableClient.UpdateEntityAsync(existingUser, ETag.All, TableUpdateMode.Replace);
                    _logger.LogInformation("Username '{Username}' reclaimed because CanBeReclaimed was true. New RecoveryCode '{Code}'.", cleanedUsername, newRecoveryCode);

                    response.StatusCode = HttpStatusCode.OK;
                    await response.WriteAsJsonAsync(new { Username = cleanedUsername, RecoveryCode = newRecoveryCode });
                }
                else if (!string.IsNullOrEmpty(clientCode) && clientCode.Equals(dbCode, StringComparison.OrdinalIgnoreCase))
                {
                    // Case B: Client supplied the correct recovery code! Link successfully.
                    _logger.LogInformation("Username '{Username}' verified successfully with RecoveryCode.", cleanedUsername);
                    
                    response.StatusCode = HttpStatusCode.OK;
                    await response.WriteAsJsonAsync(new { Username = cleanedUsername, RecoveryCode = dbCode });
                }
                else
                {
                    // Case C: Taken, no code or incorrect code.
                    _logger.LogWarning("Username '{Username}' taken. ClientCode: '{ClientCode}', DbCode: '{DbCode}'", cleanedUsername, clientCode, dbCode);
                    
                    response.StatusCode = string.IsNullOrEmpty(clientCode) 
                        ? HttpStatusCode.Conflict 
                        : HttpStatusCode.Unauthorized;
                    
                    await response.WriteStringAsync(string.IsNullOrEmpty(clientCode) 
                        ? "Username is already taken." 
                        : "Invalid recovery code.");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error registering username.");
            response.StatusCode = HttpStatusCode.InternalServerError;
            await response.WriteStringAsync("Internal server error during registration.");
        }

        return response;
    }

    [Function("SubmitScore")]
    public async Task<HttpResponseData> SubmitScore(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "score")] HttpRequestData req)
    {
        _logger.LogInformation("Submitting high score.");
        var response = req.CreateResponse();

        try
        {
            var body = await req.ReadAsStringAsync();
            if (string.IsNullOrEmpty(body))
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("Request body is empty.");
                return response;
            }

            var scoreSubmission = JsonSerializer.Deserialize<SubmitScoreDto>(body, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (scoreSubmission == null || string.IsNullOrWhiteSpace(scoreSubmission.Username) || scoreSubmission.Score < 0 || scoreSubmission.SurvivalTime <= 0)
            {
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("Invalid score submission data.");
                return response;
            }

            var serviceClient = GetTableServiceClient();
            var tableClient = serviceClient.GetTableClient(TableName);
            await tableClient.CreateIfNotExistsAsync();

            // Verify the user exists (casing insensitive check using LowerInvariant RowKey)
            var normalizedUsername = scoreSubmission.Username.Trim().ToLowerInvariant();
            TableEntity userEntity;
            try
            {
                userEntity = await tableClient.GetEntityAsync<TableEntity>("User", normalizedUsername);
            }
            catch (RequestFailedException ex) when (ex.Status == (int)HttpStatusCode.NotFound)
            {
                _logger.LogWarning("Unregistered score submission for user '{Username}'.", scoreSubmission.Username);
                response.StatusCode = HttpStatusCode.BadRequest;
                await response.WriteStringAsync("User must be registered first.");
                return response;
            }

            // Get display name from registration entity
            var displayName = userEntity.GetString("DisplayName") ?? scoreSubmission.Username;

            var scoreId = Guid.NewGuid().ToString();
            var scoreEntity = new TableEntity("Score", scoreId)
            {
                { "Username", displayName },
                { "Score", scoreSubmission.Score },
                { "SurvivalTime", scoreSubmission.SurvivalTime },
                { "PlayedAt", DateTimeOffset.UtcNow.ToString("o") }
            };

            await tableClient.AddEntityAsync(scoreEntity);
            _logger.LogInformation("Score for user '{Username}' submitted successfully.", displayName);
            
            response.StatusCode = HttpStatusCode.OK;
            await response.WriteStringAsync("Score submitted successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error submitting score.");
            response.StatusCode = HttpStatusCode.InternalServerError;
            await response.WriteStringAsync("Internal server error during score submission.");
        }

        return response;
    }
}

public class ScoreDto
{
    public string Username { get; set; } = string.Empty;
    public int Score { get; set; }
    public double SurvivalTime { get; set; }
    public string PlayedAt { get; set; } = string.Empty;
}

public class RegisterDto
{
    public string Username { get; set; } = string.Empty;
    public string? RecoveryCode { get; set; }
}

public class SubmitScoreDto
{
    public string Username { get; set; } = string.Empty;
    public int Score { get; set; }
    public double SurvivalTime { get; set; }
}
