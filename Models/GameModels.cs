namespace Asteroids.Models;

public record Point(double X, double Y);

public class Player
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Rotation { get; set; }
    public double VelocityX { get; set; }
    public double VelocityY { get; set; }
}

public class Projectile
{
    public double X { get; set; }
    public double Y { get; set; }
    public double VelocityX { get; set; }
    public double VelocityY { get; set; }
    public double Lifetime { get; set; }
}

public class Asteroid
{
    public double X { get; set; }
    public double Y { get; set; }
    public double VelocityX { get; set; }
    public double VelocityY { get; set; }
    public double Radius { get; set; }
    public List<Point> Points { get; set; } = [];
    public double Rotation { get; set; }
    public double RotationSpeed { get; set; }
}

public class Particle
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Vx { get; set; }
    public double Vy { get; set; }
    public double Life { get; set; }
    public string Color { get; set; } = "";
}

public class Star
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Size { get; set; }
    public double Opacity { get; set; }
    public int Layer { get; set; }
    public double TwinklePhase { get; set; }
}

public class InputState
{
    public bool Up { get; set; }
    public bool Down { get; set; }
    public bool Left { get; set; }
    public bool Right { get; set; }
    public bool Space { get; set; }
}

public class GameState
{
    public int Lives { get; set; }
    public double ElapsedTime { get; set; }
    public bool IsGameOver { get; set; }
    public bool HasWon { get; set; }
    public int AsteroidsRemaining { get; set; }
}

public enum SoundEffect
{
    Thrust,
    Shoot,
    Explosion,
    PlayerHit,
    Victory,
    FireworkCrackle
}

public class FrameResult
{
    public Player Player { get; set; } = new();
    public List<Asteroid> Asteroids { get; set; } = [];
    public List<Projectile> Projectiles { get; set; } = [];
    public List<Particle> Fireworks { get; set; } = [];
    public List<Particle> Explosions { get; set; } = [];
    public List<Star> Stars { get; set; } = [];
    public double ScreenShake { get; set; }
    public bool DrawPlayer { get; set; }
    public bool Invulnerable { get; set; }
    public bool Thrusting { get; set; }
    public bool IsGameOver { get; set; }
    public bool HasWon { get; set; }
    public int CanvasWidth { get; set; }
    public int CanvasHeight { get; set; }
    public List<SoundEffect> Sounds { get; set; } = [];
    public double ThrustDuration { get; set; }
    public double ExplosionRadius { get; set; }
    public GameState HudState { get; set; } = new();
    public bool VictoryJustAchieved { get; set; }
    public bool ShouldReset { get; set; }
    public List<double> PendingScores { get; set; } = [];
}