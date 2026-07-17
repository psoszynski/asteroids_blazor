using System.Net;
using System.Text.Json;
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

            var serviceClient = GetTableServiceClient();
            var tableClient = serviceClient.GetTableClient(TableName);
            await tableClient.CreateIfNotExistsAsync();

            var claimEntity = new TableEntity("User", cleanedUsername.ToLowerInvariant())
            {
                { "ClaimedAt", DateTimeOffset.UtcNow },
                { "DisplayName", cleanedUsername } // Preserve original casing
            };

            try
            {
                await tableClient.AddEntityAsync(claimEntity);
                _logger.LogInformation("Username '{Username}' registered successfully.", cleanedUsername);
                
                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { Username = cleanedUsername });
            }
            catch (RequestFailedException ex) when (ex.Status == (int)HttpStatusCode.Conflict)
            {
                _logger.LogWarning("Username '{Username}' already taken.", cleanedUsername);
                response.StatusCode = HttpStatusCode.Conflict;
                await response.WriteStringAsync("Username is already taken.");
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
}

public class SubmitScoreDto
{
    public string Username { get; set; } = string.Empty;
    public int Score { get; set; }
    public double SurvivalTime { get; set; }
}
