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
    private readonly List<PowerUp> _powerUps = [];
    private List<Star> _stars = [];

    private Point? _lastAsteroidPos;
    private bool _spacePressed;
    private long _invulnerableUntil;
    private long _startTime;
    private int _currentLevel = 1;
    private int _pendingWaveLevel;
    private long? _waveTransitionUntil;
    private long _waveTransitionStartMs;
    private int _livesInternal = GameConstants.InitialLives;
    private bool _initialized;
    private bool _scoreRecordedForRun;
    private long _gameOverTimeMs;
    private bool _gameOverRestartArmed;
    private int _canvasWidth;
    private int _canvasHeight;

    private bool _isGameOver;
    private bool _isPaused;
    private bool _pauseKeyPressed;
    private long _pauseStartMs;
    private int _scoreInternal;
    private bool _hasShield;
    private long _rapidFireUntil;
    private long _tripleShotUntil;
    private long _lastShotMs;

    /// <summary>Minimum time after game over before a restart input is accepted.</summary>
    public const int GameOverRestartDelayMs = 1500;

    public GameState State { get; } = new()
    {
        Lives = GameConstants.InitialLives,
        ElapsedTime = 0,
        IsGameOver = false,
        IsPaused = false,
        Score = 0,
        Level = 1,
        IsWaveTransition = false,
        AsteroidsRemaining = 0
    };

    public void Initialize(int width, int height)
    {
        _canvasWidth = width;
        _canvasHeight = height;
        RegenerateStars();
        StartNewRun();
        _initialized = true;
    }

    public void Resize(int width, int height)
    {
        _canvasWidth = width;
        _canvasHeight = height;
        RegenerateStars();
    }

    public void ResetGame()
    {
        RecordCurrentScore();
        StartNewRun();
    }

    private void RecordCurrentScore()
    {
        if (_scoreRecordedForRun) return;
        _scoreRecordedForRun = true;
        var finalTime = ToSec(NowMs() - _startTime);
        if (finalTime > 0)
        {
            OnScoreRecorded?.Invoke(_scoreInternal, finalTime);
        }
    }

    private void RegenerateStars() =>
        _stars = GameMath.GenerateStars(_canvasWidth, _canvasHeight, _random);

    private void StartNewRun()
    {
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
        _fireworks.Clear();
        _explosions.Clear();
        _powerUps.Clear();
        _lastAsteroidPos = null;
        _spacePressed = false;
        _invulnerableUntil = 0;
        _startTime = NowMs();
        _currentLevel = 1;
        _pendingWaveLevel = 1;
        _waveTransitionUntil = null;
        _waveTransitionStartMs = 0;
        _livesInternal = GameConstants.InitialLives;
        _isGameOver = false;
        _gameOverTimeMs = 0;
        _gameOverRestartArmed = false;
        _isPaused = false;
        _pauseKeyPressed = false;
        _pauseStartMs = 0;
        _scoreInternal = 0;
        _scoreRecordedForRun = false;
        ClearActivePowerUps();

        _asteroids.AddRange(GameMath.SpawnWave(_currentLevel, _canvasWidth, _canvasHeight, _random));

        State.Lives = GameConstants.InitialLives;
        State.ElapsedTime = 0;
        State.IsGameOver = false;
        State.IsPaused = false;
        State.Score = 0;
        State.Level = _currentLevel;
        State.IsWaveTransition = false;
        State.AsteroidsRemaining = _asteroids.Count;
        SyncActivePowerUps();
    }

    public Action<int, double>? OnScoreRecorded { get; set; }

    public void SyncHudState()
    {
        // Always keep terminal flags in sync so the Blazor HUD cannot lag or desync.
        State.IsGameOver = _isGameOver;
        State.IsPaused = _isPaused;
        State.Lives = _livesInternal;
        State.Score = _scoreInternal;
        State.Level = _waveTransitionUntil.HasValue ? _pendingWaveLevel : _currentLevel;
        State.IsWaveTransition = _waveTransitionUntil.HasValue;
        State.AsteroidsRemaining = _asteroids.Count;
        SyncActivePowerUps();

        // Freeze the mission timer while paused, during wave intro, or after game over.
        if (_isGameOver || _isPaused || _waveTransitionUntil.HasValue) return;

        State.ElapsedTime = ToSec(NowMs() - _startTime);
    }

    public FrameResult Update(double deltaMs, InputState input)
    {
        var result = new FrameResult
        {
            CanvasWidth = _canvasWidth,
            CanvasHeight = _canvasHeight,
            Stars = _stars,
            IsGameOver = _isGameOver,
            IsPaused = _isPaused
        };

        var dt = ToSec(deltaMs);

        if (!_isGameOver && !_waveTransitionUntil.HasValue)
        {
            if (input.Pause)
            {
                if (!_pauseKeyPressed)
                {
                    _pauseKeyPressed = true;
                    if (_isPaused)
                    {
                        var pausedMs = NowMs() - _pauseStartMs;
                        _startTime += pausedMs;
                        AdjustTimedEffects(pausedMs);
                        _isPaused = false;
                    }
                    else
                    {
                        _pauseStartMs = NowMs();
                        _isPaused = true;
                    }

                    State.IsPaused = _isPaused;
                }
            }
            else
            {
                _pauseKeyPressed = false;
            }
        }

        if (_isPaused && !_isGameOver)
        {
            UpdateExplosions(dt);
            UpdateFireworks(dt);

            result.Player = _player;
            result.Asteroids = [.._asteroids];
            result.Projectiles = [.._projectiles];
            result.PowerUps = [.._powerUps];
            result.Explosions = [.._explosions];
            result.Fireworks = [.._fireworks];
            result.DrawPlayer = true;
            result.Invulnerable = IsInvulnerable();
            result.IsPaused = true;
            PopulatePowerUpDisplay(result);
            result.HudState = BuildHudState();
            result.HudState.IsPaused = true;

            return result;
        }

        if (_waveTransitionUntil.HasValue)
        {
            if (NowMs() >= _waveTransitionUntil.Value)
            {
                CompleteWaveTransition();
            }
            else
            {
                UpdateFireworks(dt);
                UpdateExplosions(dt);

                result.Player = _player;
                result.Projectiles = [.._projectiles];
                result.PowerUps = [.._powerUps];
                result.Explosions = [.._explosions];
                result.Fireworks = [.._fireworks];
                result.DrawPlayer = true;
                result.Invulnerable = IsInvulnerable();
                PopulatePowerUpDisplay(result);
                result.HudState = BuildHudState(isWaveTransition: true);
                return result;
            }
        }

        if (_isGameOver)
        {
            // Restart requires: delay elapsed, space released at least once after death, then a fresh press.
            if (!input.Space)
            {
                _spacePressed = false;
                if (NowMs() - _gameOverTimeMs >= GameOverRestartDelayMs)
                {
                    _gameOverRestartArmed = true;
                }
            }
            else if (_gameOverRestartArmed && !_spacePressed)
            {
                _spacePressed = true;
                _gameOverRestartArmed = false;
                result.ShouldReset = true;
            }
            else
            {
                _spacePressed = true;
            }

            UpdateFireworks(dt);
            UpdateExplosions(dt);
            result.Fireworks = [.._fireworks];
            result.Explosions = [.._explosions];
            result.HudState = BuildHudState();
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

        TryShoot(input, result);

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
                if (GameMath.CirclesOverlap(p.X, p.Y, 0, a.X, a.Y, a.Radius))
                {
                    hit = true;
                    _lastAsteroidPos = new Point(a.X, a.Y);
                    result.Sounds.Add(SoundEffect.Explosion);
                    result.ExplosionRadius = a.Radius;
                    result.ScreenShake = Math.Max(result.ScreenShake, Math.Min(14, a.Radius * 0.35));
                    SpawnExplosion(a.X, a.Y, a.Radius);
                    _scoreInternal += GameMath.GetAsteroidPoints(a.Radius);
                    State.Score = _scoreInternal;

                    if (a.Radius > GameConstants.MinAsteroidSize)
                    {
                        var newSize = a.Radius == GameConstants.MaxAsteroidSize
                            ? GameConstants.AsteroidSizes[1]
                            : GameConstants.AsteroidSizes[2];
                        spawned.Add(GameMath.CreateAsteroid(a.X, a.Y, newSize, _random));
                        spawned.Add(GameMath.CreateAsteroid(a.X, a.Y, newSize, _random));
                    }

                    TrySpawnPowerUp(a.X, a.Y);
                    _asteroids.RemoveAt(ai);
                }
            }

            if (hit)
            {
                _projectiles.RemoveAt(pi);
            }
        }

        _asteroids.AddRange(spawned);

        UpdatePowerUps(dt);
        CollectPowerUps(result);

        if (_initialized && _asteroids.Count == 0 && !_waveTransitionUntil.HasValue)
        {
            BeginWaveTransition(result);
        }

        ResolvePlayerCollisions(result);

        UpdateExplosions(dt);

        result.Player = _player;
        result.Asteroids = [.._asteroids];
        result.Projectiles = [.._projectiles];
        result.PowerUps = [.._powerUps];
        result.Explosions = [.._explosions];
        result.DrawPlayer = !_isGameOver;
        result.Invulnerable = IsInvulnerable();
        PopulatePowerUpDisplay(result);
        result.HudState = BuildHudState();

        return result;
    }

    private void BeginWaveTransition(FrameResult result)
    {
        _pendingWaveLevel = _currentLevel + 1;
        _waveTransitionStartMs = NowMs();
        _waveTransitionUntil = _waveTransitionStartMs +
                               (long)(GameConstants.WaveTransitionSeconds * 1000);

        State.IsWaveTransition = true;
        State.Level = _pendingWaveLevel;
        State.AsteroidsRemaining = 0;

        result.Sounds.Add(SoundEffect.FireworkCrackle);

        if (_lastAsteroidPos is { } pos)
        {
            for (var i = 0; i < 80; i++)
            {
                var angle = _random.NextDouble() * Math.PI * 2;
                var speed = _random.NextDouble() * 200 + 40;
                _fireworks.Add(new Particle
                {
                    X = pos.X,
                    Y = pos.Y,
                    Vx = Math.Cos(angle) * speed,
                    Vy = Math.Sin(angle) * speed,
                    Life = 2.5,
                    Color = $"hsl({_random.NextDouble() * 360}, 100%, 70%)"
                });
            }
        }
    }

    private void CompleteWaveTransition()
    {
        var transitionMs = NowMs() - _waveTransitionStartMs;
        _startTime += transitionMs;
        AdjustTimedEffects(transitionMs);
        _currentLevel = _pendingWaveLevel;
        _waveTransitionUntil = null;
        _projectiles.Clear();
        _powerUps.Clear();
        _asteroids.AddRange(GameMath.SpawnWave(_currentLevel, _canvasWidth, _canvasHeight, _random));

        State.Level = _currentLevel;
        State.IsWaveTransition = false;
        State.AsteroidsRemaining = _asteroids.Count;
    }

    private GameState BuildHudState(bool isWaveTransition = false) => new()
    {
        Lives = _livesInternal,
        ElapsedTime = State.ElapsedTime,
        IsGameOver = _isGameOver,
        IsPaused = _isPaused && !_isGameOver,
        Score = _scoreInternal,
        Level = isWaveTransition ? _pendingWaveLevel : _currentLevel,
        IsWaveTransition = !_isGameOver && (isWaveTransition || _waveTransitionUntil.HasValue),
        HasShield = _hasShield,
        RapidFireRemaining = GetRapidFireRemaining(),
        TripleShotRemaining = GetTripleShotRemaining(),
        AsteroidsRemaining = _asteroids.Count
    };

    private void TryShoot(InputState input, FrameResult result)
    {
        var rapidFire = HasRapidFireActive();
        var canShoot = rapidFire
            ? input.Space && NowMs() - _lastShotMs >= (long)(GameConstants.RapidFireCooldownSeconds * 1000)
            : input.Space && !_spacePressed;

        if (!canShoot)
        {
            if (!input.Space)
            {
                _spacePressed = false;
            }

            return;
        }

        result.Sounds.Add(SoundEffect.Shoot);
        _spacePressed = true;
        _lastShotMs = NowMs();
        FireProjectiles();
    }

    private void FireProjectiles()
    {
        var spread = HasTripleShotActive()
            ? new[] { -GameConstants.TripleShotSpreadRadians, 0, GameConstants.TripleShotSpreadRadians }
            : new[] { 0.0 };

        foreach (var offset in spread)
        {
            var rotation = _player.Rotation + offset;
            _projectiles.Add(new Projectile
            {
                X = _player.X + Math.Cos(rotation) * 20,
                Y = _player.Y + Math.Sin(rotation) * 20,
                VelocityX = Math.Cos(rotation) * 400 + _player.VelocityX,
                VelocityY = Math.Sin(rotation) * 400 + _player.VelocityY,
                Lifetime = 2
            });
        }
    }

    private void TrySpawnPowerUp(double x, double y)
    {
        if (_random.NextDouble() >= GameConstants.PowerUpDropChance) return;

        var type = (PowerUpType)_random.Next(0, 3);
        _powerUps.Add(GameMath.CreatePowerUp(x, y, type, _random));
    }

    private void UpdatePowerUps(double dt)
    {
        foreach (var powerUp in _powerUps)
        {
            powerUp.X += powerUp.VelocityX * dt;
            powerUp.Y += powerUp.VelocityY * dt;
            powerUp.Lifetime -= dt;
            powerUp.X = GameMath.WrapRadius(powerUp.X, 0, _canvasWidth, GameConstants.PowerUpRadius);
            powerUp.Y = GameMath.WrapRadius(powerUp.Y, 0, _canvasHeight, GameConstants.PowerUpRadius);
        }

        _powerUps.RemoveAll(p => p.Lifetime <= 0);
    }

    private void CollectPowerUps(FrameResult result)
    {
        for (var i = _powerUps.Count - 1; i >= 0; i--)
        {
            var powerUp = _powerUps[i];
            if (!GameMath.CirclesOverlap(
                    _player.X, _player.Y, GameConstants.PowerUpPickupPadding,
                    powerUp.X, powerUp.Y, GameConstants.PowerUpRadius))
            {
                continue;
            }

            ActivatePowerUp(powerUp.Type);
            _powerUps.RemoveAt(i);
            result.ScreenShake = Math.Max(result.ScreenShake, 3);
        }
    }

    private void ActivatePowerUp(PowerUpType type)
    {
        var durationMs = (long)(GameConstants.PowerUpDuration * 1000);

        switch (type)
        {
            case PowerUpType.Shield:
                _hasShield = true;
                break;
            case PowerUpType.RapidFire:
                _rapidFireUntil = Math.Max(_rapidFireUntil, NowMs()) + durationMs;
                break;
            case PowerUpType.TripleShot:
                _tripleShotUntil = Math.Max(_tripleShotUntil, NowMs()) + durationMs;
                break;
        }

        SyncActivePowerUps();
    }

    private void ClearActivePowerUps()
    {
        _hasShield = false;
        _rapidFireUntil = 0;
        _tripleShotUntil = 0;
        _lastShotMs = 0;
        SyncActivePowerUps();
    }

    private void SyncActivePowerUps()
    {
        State.HasShield = _hasShield;
        State.RapidFireRemaining = GetRapidFireRemaining();
        State.TripleShotRemaining = GetTripleShotRemaining();
    }

    private void PopulatePowerUpDisplay(FrameResult result)
    {
        SyncActivePowerUps();
        result.HasShield = _hasShield;
        result.RapidFireRemaining = State.RapidFireRemaining;
        result.TripleShotRemaining = State.TripleShotRemaining;
    }

    private void ResolvePlayerCollisions(FrameResult result)
    {
        if (IsInvulnerable()) return;

        foreach (var a in _asteroids)
        {
            if (!GameMath.CirclesOverlap(
                    _player.X, _player.Y, GameConstants.PlayerHitPadding,
                    a.X, a.Y, a.Radius))
            {
                continue;
            }

            if (_hasShield)
            {
                _hasShield = false;
                result.Sounds.Add(SoundEffect.PlayerHit);
                result.ScreenShake = Math.Max(result.ScreenShake, 6);
                SpawnExplosion(_player.X, _player.Y, 14);
                _invulnerableUntil = NowMs() + (long)(GameConstants.InvulnerabilityDuration * 1000);
                SyncActivePowerUps();
            }
            else
            {
                result.Sounds.Add(SoundEffect.PlayerHit);
                result.ScreenShake = Math.Max(result.ScreenShake, 10);
                SpawnExplosion(_player.X, _player.Y, 18);
                _livesInternal -= 1;
                State.Lives = _livesInternal;
                _invulnerableUntil = NowMs() + (long)(GameConstants.InvulnerabilityDuration * 1000);

                if (_livesInternal <= 0)
                {
                    EnterGameOver();
                }
            }

            return;
        }
    }

    private void AdjustTimedEffects(long frozenMs)
    {
        if (frozenMs <= 0) return;

        if (HasRapidFireActive())
        {
            _rapidFireUntil += frozenMs;
        }

        if (HasTripleShotActive())
        {
            _tripleShotUntil += frozenMs;
        }

        SyncActivePowerUps();
    }

    private bool HasRapidFireActive() => NowMs() < _rapidFireUntil;

    private bool HasTripleShotActive() => NowMs() < _tripleShotUntil;

    private double GetRapidFireRemaining() =>
        HasRapidFireActive() ? ToSec(_rapidFireUntil - NowMs()) : 0;

    private double GetTripleShotRemaining() =>
        HasTripleShotActive() ? ToSec(_tripleShotUntil - NowMs()) : 0;

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

    public long GetTimeSinceGameOverMs() =>
        _isGameOver ? (NowMs() - _gameOverTimeMs) : long.MaxValue;

    public bool CanRestartFromGameOver() =>
        _isGameOver && NowMs() - _gameOverTimeMs >= GameOverRestartDelayMs;

    private void EnterGameOver()
    {
        if (_isGameOver) return;

        _isGameOver = true;
        _gameOverTimeMs = NowMs();
        _gameOverRestartArmed = false;
        // Force a release of space after death so a held fire key cannot restart the run.
        _spacePressed = true;
        _isPaused = false;

        State.IsGameOver = true;
        State.IsPaused = false;
        State.Lives = _livesInternal;
        State.Score = _scoreInternal;
        State.Level = _currentLevel;
        State.AsteroidsRemaining = _asteroids.Count;
        // Freeze survival time at the moment of death.
        State.ElapsedTime = ToSec(NowMs() - _startTime);
        SyncActivePowerUps();
        RecordCurrentScore();
    }

    private bool IsInvulnerable() => NowMs() < _invulnerableUntil;

    private static long NowMs() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    private static double ToSec(long ms) => ms / 1000.0;
    private static double ToSec(double ms) => ms / 1000.0;
}