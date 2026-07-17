using System.Globalization;
using System.Text.Json;
using Asteroids.Models;
using Microsoft.JSInterop;

namespace Asteroids.Services;

public class HighScoreService(IJSRuntime js)
{
    private const string StorageKey = "asteroids_highscores";
    private const int MaxEntries = 10;

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

            if (time > 0 || playedAt is not null || score > 0)
            {
                entries.Add(new HighScoreEntry
                {
                    Score = score,
                    SurvivalTime = time,
                    PlayedAt = string.IsNullOrWhiteSpace(playedAt) ? null : playedAt
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
