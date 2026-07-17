namespace Asteroids.Game;

public static class GameConstants
{
    public const int InitialLives = 3;
    public const double InvulnerabilityDuration = 3;
    public const double WaveTransitionSeconds = 2;

    public static readonly double[] AsteroidSizes = [40, 25, 15];
    public const double MaxAsteroidSize = 40;
    public const double MinAsteroidSize = 15;

    public const double MinAsteroidSpeed = 40;
    public const double MaxAsteroidSpeed = 120;
    public const int NumLargeAsteroids = 8;
    public const int WaveAsteroidsPerLevel = 2;
    public const double WaveSpeedBonusPerLevel = 12;
    public const double MaxAsteroidSpeedCap = 200;

    public const int LargeAsteroidPoints = 20;
    public const int MediumAsteroidPoints = 50;
    public const int SmallAsteroidPoints = 100;

    public const double PowerUpDropChance = 0.15;
    public const double PowerUpLifetime = 10;
    public const double PowerUpDuration = 8;
    public const double PowerUpRadius = 12;
    public const double PlayerHitPadding = 10;
    public const double PowerUpPickupPadding = 12;
    public const double RapidFireCooldownSeconds = 0.12;
    public const double TripleShotSpreadRadians = 0.26;
}