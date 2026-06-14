using Asteroids.Models;
using Microsoft.JSInterop;

namespace Asteroids.Services;

public class GameSoundService(IJSRuntime js)
{
    public async Task PlayAsync(SoundEffect effect, double param = 0)
    {
        await js.InvokeVoidAsync("gameSound.play", effect.ToString(), param);
    }
}