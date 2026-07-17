using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Asteroids.Models;
using Microsoft.JSInterop;

namespace Asteroids.Services;

public class HighScoreService(IJSRuntime js, HttpClient http)
{
    private const string StorageKey = "asteroids_highscores";
    private const int MaxEntries = 10;

    public async Task<List<HighScoreEntry>> GetGlobalHighScoresAsync()
    {
        try
        {
            var response = await http.GetFromJsonAsync<List<HighScoreEntry>>("api/leaderboard");
            return response ?? [];
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[GetGlobalHighScores Error] {ex.Message}");
            return [];
        }
    }

    public async Task<(bool Success, string CleanedName, string ErrorMessage)> RegisterUsernameAsync(string username)
    {
        try
        {
            var response = await http.PostAsJsonAsync("api/register", new { Username = username });
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<RegisterResponse>();
                return (true, result?.Username ?? username, string.Empty);
            }
            
            var err = await response.Content.ReadAsStringAsync();
            return (false, string.Empty, string.IsNullOrEmpty(err) ? "Username is already taken or invalid." : err);
        }
        catch (Exception ex)
        {
            return (false, string.Empty, $"Network error: {ex.Message}");
        }
    }

    public async Task<bool> SubmitGlobalScoreAsync(string username, int score, double survivalTime)
    {
        try
        {
            var response = await http.PostAsJsonAsync("api/score", new { Username = username, Score = score, SurvivalTime = survivalTime });
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SubmitGlobalScore Error] {ex.Message}");
            return false;
        }
    }

    public async Task<string?> GetSavedUsernameAsync()
    {
        try
        {
            return await js.InvokeAsync<string?>("localStorage.getItem", "asteroids_username");
        }
        catch
        {
            return null;
        }
    }

    public async Task SaveUsernameAsync(string username)
    {
        try
        {
            await js.InvokeVoidAsync("localStorage.setItem", "asteroids_username", username);
        }
        catch {}
    }

    private class RegisterResponse
    {
        public string Username { get; set; } = string.Empty;
    }

    public async Task<List<HighScoreEntry>> GetHighScoresAsync()
    {
        try
        {
            var raw = await js.InvokeAsync<JsonElement>("gameStorage.getHighScores", StorageKey);
            return NormalizeAndSort(ParseEntries(raw));
        }
        catch
        {
            return [];
        }
    }

    public async Task<List<HighScoreEntry>> AddHighScoreAsync(int score, double survivalTime)
    {
        var scores = await GetHighScoresAsync();
        scores.Add(new HighScoreEntry
        {
            Score = score,
            SurvivalTime = survivalTime,
            PlayedAt = DateTimeOffset.Now.ToString("o", CultureInfo.InvariantCulture)
        });

        var top = NormalizeAndSort(scores).Take(MaxEntries).ToList();
        await js.InvokeVoidAsync("gameStorage.setHighScores", StorageKey, top);
        return top;
    }

    private static List<HighScoreEntry> ParseEntries(JsonElement raw)
    {
        if (raw.ValueKind != JsonValueKind.Array) return [];

        var entries = new List<HighScoreEntry>();
        foreach (var item in raw.EnumerateArray())
        {
            // Legacy format: plain number (survival seconds only).
            if (item.ValueKind is JsonValueKind.Number)
            {
                entries.Add(new HighScoreEntry
                {
                    SurvivalTime = item.GetDouble(),
                    PlayedAt = null
                });
                continue;
            }

            if (item.ValueKind != JsonValueKind.Object) continue;

            var time = 0.0;
            if (item.TryGetProperty("survivalTime", out var st) && st.ValueKind == JsonValueKind.Number)
            {
                time = st.GetDouble();
            }
            else if (item.TryGetProperty("SurvivalTime", out var st2) && st2.ValueKind == JsonValueKind.Number)
            {
                time = st2.GetDouble();
            }

            string? playedAt = null;
            if (item.TryGetProperty("playedAt", out var pa) && pa.ValueKind == JsonValueKind.String)
            {
                playedAt = pa.GetString();
            }
            else if (item.TryGetProperty("PlayedAt", out var pa2) && pa2.ValueKind == JsonValueKind.String)
            {
                playedAt = pa2.GetString();
            }

            var score = 0;
            if (item.TryGetProperty("score", out var sc) && sc.ValueKind == JsonValueKind.Number)
            {
                score = sc.GetInt32();
            }
            else if (item.TryGetProperty("Score", out var sc2) && sc2.ValueKind == JsonValueKind.Number)
            {
                score = sc2.GetInt32();
            }

            string? username = null;
            if (item.TryGetProperty("username", out var un) && un.ValueKind == JsonValueKind.String)
            {
                username = un.GetString();
            }
            else if (item.TryGetProperty("Username", out var un2) && un2.ValueKind == JsonValueKind.String)
            {
                username = un2.GetString();
            }

            if (time > 0 || playedAt is not null || score > 0)
            {
                entries.Add(new HighScoreEntry
                {
                    Score = score,
                    SurvivalTime = time,
                    PlayedAt = string.IsNullOrWhiteSpace(playedAt) ? null : playedAt,
                    Username = username
                });
            }
        }

        return entries;
    }

    private static List<HighScoreEntry> NormalizeAndSort(IEnumerable<HighScoreEntry> entries) =>
        entries
            .OrderByDescending(e => e.Score)
            .ThenByDescending(e => e.SurvivalTime)
            .ToList();
}
