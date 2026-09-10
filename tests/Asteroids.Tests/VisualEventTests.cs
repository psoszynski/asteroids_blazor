using System.Reflection;
using Asteroids.Game;
using Asteroids.Models;

namespace Asteroids.Tests;

public class VisualEventTests
{
    private static List<T> Items<T>(GameEngine engine, string name) =>
        (List<T>)typeof(GameEngine).GetField(name, BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(engine)!;

    [Fact]
    public void SimultaneousImpactsHaveDistinctEventsAndDoNotReplay()
    {
        var engine = new GameEngine();
        engine.Initialize(1100, 800);
        var rocks = Items<Asteroid>(engine, "_asteroids");
        rocks.Clear();
        var shots = Items<Projectile>(engine, "_projectiles");
        foreach (var x in new[] { 100, 300 })
        {
            rocks.Add(new Asteroid { Id = x, X = x, Y = 100, Radius = 15 });
            shots.Add(new Projectile { X = x, Y = 100, Lifetime = 1, VelocityX = 100 });
        }
        // Keep the wave alive so the next frame checks ordinary event consumption.
        rocks.Add(new Asteroid { Id = 900, X = 900, Y = 100, Radius = 15 });
        var frame = engine.Update(0, new InputState());
        Assert.Equal(2, frame.VisualEvents.Count);
        Assert.Equal(2, frame.VisualEvents.Select(e => e.Id).Distinct().Count());
        Assert.Equal(new[] { 100.0, 300.0 }, frame.VisualEvents.Select(e => e.X).Order().ToArray());
        Assert.All(frame.VisualEvents, e => { Assert.Equal("asteroid", e.Type); Assert.Equal(frame.RunId, e.RunId); });
        Assert.Equal(2, frame.Sounds.Count(s => s == SoundEffect.Explosion));
        Assert.Empty(engine.Update(0, new InputState()).VisualEvents);
        engine.ResetGame();
        var restarted = engine.Update(0, new InputState());
        Assert.NotEqual(frame.RunId, restarted.RunId);
        Assert.Empty(restarted.VisualEvents);
    }

    [Theory]
    [InlineData(false, "damage")]
    [InlineData(true, "shield")]
    public void PlayerCollisionReportsTheCorrectImpact(bool shield, string type)
    {
        var engine = new GameEngine();
        engine.Initialize(1100, 800);
        // Clear the randomly spawned wave immediately so it cannot coincidentally
        // overlap the player and consume the invulnerability window before the
        // test's own asteroid is placed; read the player position directly
        // instead of via Update (an empty asteroid list would otherwise start
        // a wave transition).
        var rocks = Items<Asteroid>(engine, "_asteroids");
        rocks.Clear();
        var player = (Player)typeof(GameEngine).GetField("_player", BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(engine)!;
        rocks.Add(new Asteroid { X = player.X, Y = player.Y, Radius = 15 });
        typeof(GameEngine).GetField("_hasShield", BindingFlags.NonPublic | BindingFlags.Instance)!.SetValue(engine, shield);
        var impact = engine.Update(0, new InputState());
        Assert.Equal(type, Assert.Single(impact.VisualEvents).Type);
        Assert.Single(impact.Sounds, s => s == SoundEffect.PlayerHit);
    }

    [Fact]
    public void PickupEventRetainsItsLocationAndType()
    {
        var engine = new GameEngine();
        engine.Initialize(1100, 800);
        var player = engine.Update(0, new InputState()).Player;
        Items<PowerUp>(engine, "_powerUps").Add(new PowerUp {
            X = player.X, Y = player.Y, Type = PowerUpType.TripleShot, Lifetime = 10
        });
        var effect = Assert.Single(engine.Update(0, new InputState()).VisualEvents);
        Assert.Equal("pickup", effect.Type);
        Assert.Equal(player.X, effect.X);
        Assert.Equal((double)PowerUpType.TripleShot, effect.Direction);
    }
}
