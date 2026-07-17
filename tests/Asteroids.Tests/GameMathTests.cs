using Asteroids.Game;

namespace Asteroids.Tests;

public class GameMathTests
{
    [Theory]
    [InlineData(5, 0, 10, 5)]
    [InlineData(-1, 0, 10, 10)]
    [InlineData(11, 0, 10, 0)]
    public void Wrap_ReturnsExpectedValue(double value, double min, double max, double expected)
    {
        Assert.Equal(expected, GameMath.Wrap(value, min, max));
    }

    [Fact]
    public void Dist_ComputesEuclideanDistance()
    {
        Assert.Equal(5, GameMath.Dist(0, 0, 3, 4), precision: 10);
    }

    [Fact]
    public void CirclesOverlap_WhenCentersCloserThanSumOfRadii()
    {
        Assert.True(GameMath.CirclesOverlap(0, 0, 5, 3, 0, 5));
        Assert.False(GameMath.CirclesOverlap(0, 0, 2, 10, 0, 2));
    }

    [Theory]
    [InlineData(1, 8)]
    [InlineData(2, 10)]
    [InlineData(3, 12)]
    public void GetWaveAsteroidCount_ScalesWithLevel(int level, int expected)
    {
        Assert.Equal(expected, GameMath.GetWaveAsteroidCount(level));
    }

    [Theory]
    [InlineData(40, 20)]
    [InlineData(25, 50)]
    [InlineData(15, 100)]
    public void GetAsteroidPoints_ByRadius(double radius, int expectedPoints)
    {
        Assert.Equal(expectedPoints, GameMath.GetAsteroidPoints(radius));
    }

    [Theory]
    [InlineData(0, "00:00")]
    [InlineData(65, "01:05")]
    [InlineData(125.9, "02:05")]
    public void FormatTime_FormatsMinutesAndSeconds(double seconds, string expected)
    {
        Assert.Equal(expected, GameMath.FormatTime(seconds));
    }

    [Fact]
    public void FormatPlayedAt_ReturnsPlaceholder_WhenMissingOrInvalid()
    {
        Assert.Equal("—", GameMath.FormatPlayedAt(null));
        Assert.Equal("—", GameMath.FormatPlayedAt(""));
        Assert.Equal("—", GameMath.FormatPlayedAt("not-a-date"));
    }
}
