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

    public static (double VelocityX, double VelocityY) RandomVelocity(Random random)
    {
        var angle = random.NextDouble() * Math.PI * 2;
        var speed = GameConstants.MinAsteroidSpeed +
                    random.NextDouble() * (GameConstants.MaxAsteroidSpeed - GameConstants.MinAsteroidSpeed);
        return (Math.Cos(angle) * speed, Math.Sin(angle) * speed);
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

    public static Asteroid CreateAsteroid(double x, double y, double radius, Random random)
    {
        var (vx, vy) = RandomVelocity(random);
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

    public static string FormatTime(double seconds)
    {
        var mins = (int)Math.Floor(seconds / 60);
        var secs = (int)Math.Floor(seconds % 60);
        return $"{mins:D2}:{secs:D2}";
    }
}