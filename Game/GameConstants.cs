namespace Asteroids.Game;

public static class GameConstants
{
    public const int InitialLives = 3;
    public const double InvulnerabilityDuration = 3;
    public const double VictoryDelaySeconds = 5;

    public static readonly double[] AsteroidSizes = [40, 25, 15];
    public const double MaxAsteroidSize = 40;
    public const double MinAsteroidSize = 15;

    public const double MinAsteroidSpeed = 40;
    public const double MaxAsteroidSpeed = 120;
    public const int NumLargeAsteroids = 8;
}