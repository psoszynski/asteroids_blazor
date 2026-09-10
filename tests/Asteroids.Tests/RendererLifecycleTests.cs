using Asteroids.Game;
using Asteroids.Models;

namespace Asteroids.Tests;

public class RendererLifecycleTests
{
    private sealed class ManualTime : TimeProvider
    {
        public DateTimeOffset Current { get; set; } = DateTimeOffset.FromUnixTimeMilliseconds(1_000_000);
        public override DateTimeOffset GetUtcNow() => Current;
        public void Advance(int seconds) => Current = Current.AddSeconds(seconds);
    }

    [Fact]
    public void RendererRecoveryFreezesClockAndMovement()
    {
        var time = new ManualTime();
        var engine = new GameEngine(time);
        engine.Initialize(1440, 900);
        time.Advance(2);
        engine.SyncHudState();
        var elapsed = engine.State.ElapsedTime;
        var before = engine.Update(0, new InputState());
        var x = before.Player.X;
        var y = before.Player.Y;
        engine.SetRendererSuspended(true);
        time.Advance(30);
        var held = engine.Update(1000, new InputState { Up = true, Space = true });
        engine.SyncHudState();
        Assert.Equal(x, held.Player.X);
        Assert.Equal(y, held.Player.Y);
        Assert.Equal(elapsed, engine.State.ElapsedTime);
        Assert.Empty(held.Projectiles);
        engine.SetRendererSuspended(false);
        time.Advance(1);
        engine.SyncHudState();
        Assert.Equal(elapsed + 1, engine.State.ElapsedTime);
        Assert.Equal(before.RunId, engine.Update(0, new InputState()).RunId);
    }

    [Fact]
    public void RecoveryPreservesAnExistingUserPause()
    {
        var time = new ManualTime();
        var engine = new GameEngine(time);
        engine.Initialize(1440, 900);
        engine.Update(0, new InputState { Pause = true });
        engine.SetRendererSuspended(true);
        time.Advance(30);
        engine.SetRendererSuspended(false);
        Assert.True(engine.Update(0, new InputState()).IsPaused);
    }

    [Fact]
    public void AsteroidsHaveUniqueIdsAndConsistentVisualSeeds()
    {
        var engine = new GameEngine(new ManualTime());
        engine.Initialize(1440, 900);
        var frame = engine.Update(0, new InputState());
        Assert.NotEmpty(frame.Asteroids);
        Assert.Equal(frame.Asteroids.Count, frame.Asteroids.Select(a => a.Id).Distinct().Count());
        Assert.All(frame.Asteroids, a => Assert.Equal(GameMath.HashSeed(a.Id), a.VisualSeed));

        // Ids stay stable across frames while nothing is destroyed.
        var idsBefore = frame.Asteroids.Select(a => a.Id).OrderBy(id => id).ToList();
        var next = engine.Update(16, new InputState());
        Assert.Equal(idsBefore, next.Asteroids.Select(a => a.Id).OrderBy(id => id).ToList());
    }

    [Fact]
    public void RunIdChangesOnlyWhenANewRunStarts()
    {
        var engine = new GameEngine(new ManualTime());
        engine.Initialize(1440, 900);
        var initial = engine.Update(0, new InputState()).RunId;
        engine.Resize(800, 1200);
        Assert.Equal(initial, engine.Update(0, new InputState()).RunId);
        engine.ResetGame();
        Assert.True(engine.Update(0, new InputState()).RunId > initial);
    }
}
