using Asteroids.Models;

namespace Asteroids.Game;

public class GameEngine
{
    private readonly Random _random = new();

    private Player _player = new();
    private readonly List<Projectile> _projectiles = [];
    private readonly List<Asteroid> _asteroids = [];
    private readonly List<Particle> _fireworks = [];
    private readonly List<Particle> _explosions = [];
    private List<Star> _stars = [];

    private Point? _lastAsteroidPos;
    private bool _spacePressed;
    private long _invulnerableUntil;
    private long _startTime;
    private long? _victoryTime;
    private bool _victorySoundPlayed;
    private int _livesInternal = GameConstants.InitialLives;
    private bool _initialized;
    private int _canvasWidth;
    private int _canvasHeight;

    private bool _isGameOver;
    private bool _hasWon;

    public GameState State { get; } = new()
    {
        Lives = GameConstants.InitialLives,
        ElapsedTime = 0,
        IsGameOver = false,
        HasWon = false,
        AsteroidsRemaining = 0
    };

    public void Initialize(int width, int height)
    {
        _canvasWidth = width;
        _canvasHeight = height;
        _stars = GameMath.GenerateStars(width, height, _random);
        _asteroids.Clear();
        _asteroids.AddRange(GameMath.SpawnLargeAsteroids(GameConstants.NumLargeAsteroids, width, height, _random));
        _player = new Player
        {
            X = width / 2.0,
            Y = height / 2.0,
            Rotation = -Math.PI / 2,
            VelocityX = 0,
            VelocityY = 0
        };
        _startTime = NowMs();
        _initialized = true;
    }

    public void Resize(int width, int height)
    {
        _canvasWidth = width;
        _canvasHeight = height;
        _stars = GameMath.GenerateStars(width, height, _random);
    }

    public void ResetGame()
    {
        var finalTime = ToSec(NowMs() - _startTime);
        if (finalTime > 0)
        {
            OnScoreRecorded?.Invoke(finalTime);
        }

        _player = new Player
        {
            X = _canvasWidth / 2.0,
            Y = _canvasHeight / 2.0,
            Rotation = -Math.PI / 2,
            VelocityX = 0,
            VelocityY = 0
        };

        _projectiles.Clear();
        _asteroids.Clear();
        _asteroids.AddRange(GameMath.SpawnLargeAsteroids(GameConstants.NumLargeAsteroids, _canvasWidth, _canvasHeight, _random));
        _fireworks.Clear();
        _explosions.Clear();
        _lastAsteroidPos = null;
        _spacePressed = false;
        _invulnerableUntil = 0;
        _startTime = NowMs();
        _victoryTime = null;
        _victorySoundPlayed = false;
        _livesInternal = GameConstants.InitialLives;
        _isGameOver = false;
        _hasWon = false;

        State.Lives = GameConstants.InitialLives;
        State.ElapsedTime = 0;
        State.IsGameOver = false;
        State.HasWon = false;
        State.AsteroidsRemaining = 0;
    }

    public Action<double>? OnScoreRecorded { get; set; }

    public void SyncHudState()
    {
        if (_isGameOver || _hasWon) return;

        State.ElapsedTime = ToSec(NowMs() - _startTime);
        State.Lives = _livesInternal;
        State.AsteroidsRemaining = _asteroids.Count;
    }

    public FrameResult Update(double deltaMs, InputState input)
    {
        var result = new FrameResult
        {
            CanvasWidth = _canvasWidth,
            CanvasHeight = _canvasHeight,
            Stars = _stars,
            IsGameOver = _isGameOver,
            HasWon = _hasWon
        };

        var dt = ToSec(deltaMs);

        if (_isGameOver || _hasWon)
        {
            var hasActiveFireworks = _fireworks.Count > 0;

            if (_hasWon && _victoryTime.HasValue)
            {
                var elapsedVictory = ToSec(NowMs() - _victoryTime.Value);

                if (elapsedVictory < GameConstants.VictoryDelaySeconds)
                {
                    if (!_victorySoundPlayed && elapsedVictory < 1)
                    {
                        _victorySoundPlayed = true;
                        result.Sounds.Add(SoundEffect.FireworkCrackle);
                    }

                    UpdateFireworks(dt);
                    UpdateExplosions(dt);
                    result.Fireworks = [.._fireworks];
                    result.Explosions = [.._explosions];
                    return result;
                }

                if (!hasActiveFireworks && input.Space)
                {
                    if (!_spacePressed)
                    {
                        _spacePressed = true;
                        result.ShouldReset = true;
                    }
                }
                else
                {
                    _spacePressed = false;
                }
            }
            else if (_isGameOver)
            {
                if (input.Space)
                {
                    if (!_spacePressed)
                    {
                        _spacePressed = true;
                        result.ShouldReset = true;
                    }
                }
                else
                {
                    _spacePressed = false;
                }
            }

            UpdateFireworks(dt);
            UpdateExplosions(dt);
            result.Fireworks = [.._fireworks];
            result.Explosions = [.._explosions];
            return result;
        }

        if (input.Left) _player.Rotation -= 2 * dt;
        if (input.Right) _player.Rotation += 2 * dt;

        if (input.Up || input.Down)
        {
            var thrust = 150 * dt;
            _player.VelocityX += Math.Cos(_player.Rotation) * thrust;
            _player.VelocityY += Math.Sin(_player.Rotation) * thrust;
            result.Sounds.Add(SoundEffect.Thrust);
            result.ThrustDuration = dt;
            result.Thrusting = true;
        }

        _player.VelocityX *= 0.99;
        _player.VelocityY *= 0.99;
        _player.X += _player.VelocityX * dt;
        _player.Y += _player.VelocityY * dt;
        _player.X = GameMath.Wrap(_player.X, 0, _canvasWidth);
        _player.Y = GameMath.Wrap(_player.Y, 0, _canvasHeight);

        if (input.Space && !_spacePressed)
        {
            result.Sounds.Add(SoundEffect.Shoot);
            _spacePressed = true;
            _projectiles.Add(new Projectile
            {
                X = _player.X + Math.Cos(_player.Rotation) * 20,
                Y = _player.Y + Math.Sin(_player.Rotation) * 20,
                VelocityX = Math.Cos(_player.Rotation) * 400 + _player.VelocityX,
                VelocityY = Math.Sin(_player.Rotation) * 400 + _player.VelocityY,
                Lifetime = 2
            });
        }
        else if (!input.Space)
        {
            _spacePressed = false;
        }

        for (var i = _projectiles.Count - 1; i >= 0; i--)
        {
            var p = _projectiles[i];
            p.X += p.VelocityX * dt;
            p.Y += p.VelocityY * dt;
            p.Lifetime -= dt;
            p.X = GameMath.Wrap(p.X, 0, _canvasWidth);
            p.Y = GameMath.Wrap(p.Y, 0, _canvasHeight);

            if (p.Lifetime <= 0)
            {
                _projectiles.RemoveAt(i);
            }
        }

        foreach (var a in _asteroids)
        {
            a.X += a.VelocityX * dt;
            a.Y += a.VelocityY * dt;
            a.Rotation += a.RotationSpeed * dt;
            a.X = GameMath.WrapRadius(a.X, 0, _canvasWidth, a.Radius);
            a.Y = GameMath.WrapRadius(a.Y, 0, _canvasHeight, a.Radius);
        }

        var spawned = new List<Asteroid>();
        for (var pi = _projectiles.Count - 1; pi >= 0; pi--)
        {
            var p = _projectiles[pi];
            var hit = false;

            for (var ai = _asteroids.Count - 1; ai >= 0; ai--)
            {
                if (hit) break;

                var a = _asteroids[ai];
                if (GameMath.Dist(p.X, p.Y, a.X, a.Y) < a.Radius)
                {
                    hit = true;
                    _lastAsteroidPos = new Point(a.X, a.Y);
                    result.Sounds.Add(SoundEffect.Explosion);
                    result.ExplosionRadius = a.Radius;
                    result.ScreenShake = Math.Max(result.ScreenShake, Math.Min(14, a.Radius * 0.35));
                    SpawnExplosion(a.X, a.Y, a.Radius);

                    if (a.Radius > GameConstants.MinAsteroidSize)
                    {
                        var newSize = a.Radius == GameConstants.MaxAsteroidSize
                            ? GameConstants.AsteroidSizes[1]
                            : GameConstants.AsteroidSizes[2];
                        spawned.Add(GameMath.CreateAsteroid(a.X, a.Y, newSize, _random));
                        spawned.Add(GameMath.CreateAsteroid(a.X, a.Y, newSize, _random));
                    }

                    _asteroids.RemoveAt(ai);
                }
            }

            if (hit)
            {
                _projectiles.RemoveAt(pi);
            }
        }

        _asteroids.AddRange(spawned);

        if (_initialized && _asteroids.Count == 0 && !_hasWon)
        {
            var finalTime = ToSec(NowMs() - _startTime);
            OnScoreRecorded?.Invoke(finalTime);
            result.Sounds.Add(SoundEffect.Victory);
            result.VictoryJustAchieved = true;

            _victoryTime = NowMs();
            _hasWon = true;
            State.HasWon = true;
            State.ElapsedTime = finalTime;
            State.AsteroidsRemaining = 0;

            if (_lastAsteroidPos is { } pos)
            {
                for (var i = 0; i < 150; i++)
                {
                    var angle = _random.NextDouble() * Math.PI * 2;
                    var speed = _random.NextDouble() * 250 + 50;
                    _fireworks.Add(new Particle
                    {
                        X = pos.X,
                        Y = pos.Y,
                        Vx = Math.Cos(angle) * speed,
                        Vy = Math.Sin(angle) * speed,
                        Life = 5,
                        Color = $"hsl({_random.NextDouble() * 360}, 100%, 70%)"
                    });
                }
            }
        }

        var invulnerable = IsInvulnerable();
        if (!invulnerable)
        {
            foreach (var a in _asteroids)
            {
                if (GameMath.Dist(_player.X, _player.Y, a.X, a.Y) < a.Radius + 10)
                {
                    result.Sounds.Add(SoundEffect.PlayerHit);
                    result.ScreenShake = Math.Max(result.ScreenShake, 10);
                    SpawnExplosion(_player.X, _player.Y, 18);
                    _livesInternal -= 1;
                    State.Lives = _livesInternal;
                    _invulnerableUntil = NowMs() + (long)(GameConstants.InvulnerabilityDuration * 1000);

                    if (_livesInternal <= 0)
                    {
                        _isGameOver = true;
                        State.IsGameOver = true;
                    }
                }
            }
        }

        UpdateExplosions(dt);

        result.Player = _player;
        result.Asteroids = [.._asteroids];
        result.Projectiles = [.._projectiles];
        result.Explosions = [.._explosions];
        result.DrawPlayer = !_isGameOver;
        result.Invulnerable = invulnerable;
        result.HudState = new GameState
        {
            Lives = State.Lives,
            ElapsedTime = State.ElapsedTime,
            IsGameOver = State.IsGameOver,
            HasWon = State.HasWon,
            AsteroidsRemaining = _asteroids.Count
        };

        return result;
    }

    private void UpdateFireworks(double dt)
    {
        foreach (var p in _fireworks)
        {
            p.X += p.Vx * dt;
            p.Y += p.Vy * dt;
            p.Life -= dt;
        }

        _fireworks.RemoveAll(p => p.Life <= 0);
    }

    private void UpdateExplosions(double dt)
    {
        foreach (var p in _explosions)
        {
            p.X += p.Vx * dt;
            p.Y += p.Vy * dt;
            p.Vx *= 0.96;
            p.Vy *= 0.96;
            p.Life -= dt;
        }

        _explosions.RemoveAll(p => p.Life <= 0);
    }

    private void SpawnExplosion(double x, double y, double radius)
    {
        var sparkCount = (int)(10 + radius * 1.2);
        for (var i = 0; i < sparkCount; i++)
        {
            var angle = _random.NextDouble() * Math.PI * 2;
            var speed = _random.NextDouble() * 220 + 50;
            var warm = _random.NextDouble() < 0.65;
            var hue = warm ? 18 + _random.NextDouble() * 45 : 185 + _random.NextDouble() * 40;

            _explosions.Add(new Particle
            {
                X = x + (_random.NextDouble() - 0.5) * radius * 0.4,
                Y = y + (_random.NextDouble() - 0.5) * radius * 0.4,
                Vx = Math.Cos(angle) * speed,
                Vy = Math.Sin(angle) * speed,
                Life = 0.35 + _random.NextDouble() * 0.55,
                Color = $"hsl({hue:F0}, 100%, {58 + _random.NextDouble() * 22:F0}%)"
            });
        }
    }

    private bool IsInvulnerable() => NowMs() < _invulnerableUntil;

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static double ToSec(long ms) => ms / 1000.0;
    private static double ToSec(double ms) => ms / 1000.0;
}