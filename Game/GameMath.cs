using System.Globalization;
using Asteroids.Models;

namespace Asteroids.Game;

public static class GameMath
{
    public static double Wrap(double value, double min, double max)
    {
        if (value < min) return max;
        if (value > max) return min;
        return value;
    }

    public static double WrapRadius(double value, double min, double max, double r)
    {
        if (value < min - r) return max + r;
        if (value > max + r) return min - r;
        return value;
    }

    public static double Dist(double ax, double ay, double bx, double by)
    {
        var dx = ax - bx;
        var dy = ay - by;
        return Math.Sqrt(dx * dx + dy * dy);
    }

    public static bool CirclesOverlap(double ax, double ay, double radiusA, double bx, double by, double radiusB) =>
        Dist(ax, ay, bx, by) < radiusA + radiusB;

    public static (double VelocityX, double VelocityY) RandomVelocity(
        Random random,
        double? minSpeed = null,
        double? maxSpeed = null)
    {
        var min = minSpeed ?? GameConstants.MinAsteroidSpeed;
        var max = maxSpeed ?? GameConstants.MaxAsteroidSpeed;
        var angle = random.NextDouble() * Math.PI * 2;
        var speed = min + random.NextDouble() * (max - min);
        return (Math.Cos(angle) * speed, Math.Sin(angle) * speed);
    }

    public static int GetWaveAsteroidCount(int level) =>
        GameConstants.NumLargeAsteroids + (level - 1) * GameConstants.WaveAsteroidsPerLevel;

    public static (double MinSpeed, double MaxSpeed) GetWaveSpeedRange(int level)
    {
        var bonus = (level - 1) * GameConstants.WaveSpeedBonusPerLevel;
        var min = GameConstants.MinAsteroidSpeed + bonus;
        var max = Math.Min(GameConstants.MaxAsteroidSpeed + bonus, GameConstants.MaxAsteroidSpeedCap);
        return (min, max);
    }

    public static List<Point> GenerateAsteroidPoints(double radius, Random random)
    {
        var numPoints = 10 + random.Next(5);
        var points = new List<Point>(numPoints);

        for (var i = 0; i < numPoints; i++)
        {
            var baseAngle = i / (double)numPoints * Math.PI * 2;
            var angle = baseAngle + (random.NextDouble() - 0.5) * 0.3;
            var r = radius * (0.7 + random.NextDouble() * 0.6);
            points.Add(new Point(Math.Cos(angle) * r, Math.Sin(angle) * r));
        }

        return points;
    }

    public static Asteroid CreateAsteroid(
        double x,
        double y,
        double radius,
        Random random,
        double? minSpeed = null,
        double? maxSpeed = null)
    {
        var (vx, vy) = RandomVelocity(random, minSpeed, maxSpeed);
        return new Asteroid
        {
            X = x,
            Y = y,
            VelocityX = vx,
            VelocityY = vy,
            Radius = radius,
            Points = GenerateAsteroidPoints(radius, random),
            Rotation = random.NextDouble() * Math.PI * 2,
            RotationSpeed = (random.NextDouble() - 0.5) *
                            (radius == GameConstants.MaxAsteroidSize ? 2.6 : 2)
        };
    }

    public static List<Asteroid> SpawnLargeAsteroids(int count, double width, double height, Random random)
    {
        return Enumerable.Range(0, count)
            .Select(_ => CreateAsteroid(random.NextDouble() * width, random.NextDouble() * height,
                GameConstants.MaxAsteroidSize, random))
            .ToList();
    }

    public static List<Asteroid> SpawnWave(int level, double width, double height, Random random)
    {
        var count = GetWaveAsteroidCount(level);
        var (minSpeed, maxSpeed) = GetWaveSpeedRange(level);

        return Enumerable.Range(0, count)
            .Select(_ => CreateAsteroid(
                random.NextDouble() * width,
                random.NextDouble() * height,
                GameConstants.MaxAsteroidSize,
                random,
                minSpeed,
                maxSpeed))
            .ToList();
    }

    public static List<Star> GenerateStars(double width, double height, Random random)
    {
        var numStars = (int)Math.Floor(width * height / 3500);
        return Enumerable.Range(0, numStars)
            .Select(i =>
            {
                var layer = i % 3;
                return new Star
                {
                    X = random.NextDouble() * width,
                    Y = random.NextDouble() * height,
                    Size = layer == 0 ? random.NextDouble() * 1.2 + 0.3
                        : layer == 1 ? random.NextDouble() * 1.8 + 0.6
                        : random.NextDouble() * 2.5 + 1.0,
                    Opacity = layer == 0 ? random.NextDouble() * 0.35 + 0.15
                        : layer == 1 ? random.NextDouble() * 0.5 + 0.35
                        : random.NextDouble() * 0.4 + 0.6,
                    Layer = layer,
                    TwinklePhase = random.NextDouble() * Math.PI * 2
                };
            })
            .ToList();
    }

    public static PowerUp CreatePowerUp(double x, double y, PowerUpType type, Random random)
    {
        var angle = random.NextDouble() * Math.PI * 2;
        var speed = 20 + random.NextDouble() * 30;

        return new PowerUp
        {
            X = x,
            Y = y,
            VelocityX = Math.Cos(angle) * speed,
            VelocityY = Math.Sin(angle) * speed,
            Type = type,
            Lifetime = GameConstants.PowerUpLifetime
        };
    }

    public static int GetAsteroidPoints(double radius)
    {
        if (radius >= GameConstants.MaxAsteroidSize) return GameConstants.LargeAsteroidPoints;
        if (radius >= GameConstants.AsteroidSizes[1]) return GameConstants.MediumAsteroidPoints;
        return GameConstants.SmallAsteroidPoints;
    }

    public static string FormatTime(double seconds)
    {
        var mins = (int)Math.Floor(seconds / 60);
        var secs = (int)Math.Floor(seconds % 60);
        return $"{mins:D2}:{secs:D2}";
    }

    /// <summary>
    /// Formats a stored ISO-8601 play timestamp for the leaderboard (local time).
    /// Returns a placeholder when the value is missing or unparseable (legacy scores).
    /// </summary>
    public static string FormatPlayedAt(string? playedAtIso)
    {
        if (string.IsNullOrWhiteSpace(playedAtIso)) return "—";

        if (!DateTimeOffset.TryParse(
                playedAtIso,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var dto))
        {
            return "—";
        }

        var local = dto.ToLocalTime();
        return local.ToString("MMM d, yyyy · HH:mm", CultureInfo.InvariantCulture);
    }
}