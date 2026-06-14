using Microsoft.JSInterop;

namespace Asteroids.Services;

public class HighScoreService(IJSRuntime js)
{
    private const string StorageKey = "asteroids_highscores";

    public async Task<List<double>> GetHighScoresAsync()
    {
        try
        {
            var scores = await js.InvokeAsync<double[]>("gameStorage.getHighScores", StorageKey);
            return scores?.ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    public async Task<List<double>> AddHighScoreAsync(double time)
    {
        var scores = await GetHighScoresAsync();
        scores.Add(time);
        scores.Sort();
        var top10 = scores.Take(10).ToList();
        await js.InvokeVoidAsync("gameStorage.setHighScores", StorageKey, top10.ToArray());
        return top10;
    }
}