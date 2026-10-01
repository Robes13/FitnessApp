using System.Globalization;
using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Utilities;

public static class RequestGuards
{
    /// <summary>Largest value a numeric(7,2) column holds; anything larger overflows in Postgres (500).</summary>
    public const decimal MaxNumeric7Scale2 = 99_999.99m;

    /// <summary>Largest value a numeric(9,2) column holds.</summary>
    public const decimal MaxNumeric9Scale2 = 9_999_999.99m;

    public static int NormalizeLimit(int limit, int defaultValue = 50, int maximum = 100)
    {
        if (limit <= 0)
        {
            return defaultValue;
        }

        return Math.Min(limit, maximum);
    }

    public static DateTime NormalizeUtc(DateTime value)
    {
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            DateTimeKind.Unspecified => DateTime.SpecifyKind(value, DateTimeKind.Utc),
            _ => value
        };
    }

    public static void EnsureRange(DateTime from, DateTime to)
    {
        if (from >= to)
        {
            throw new BusinessValidationException("'from' must be earlier than 'to'. The range uses an inclusive 'from' and exclusive 'to'.");
        }
    }

    public static void EnsurePositive(decimal value, string fieldName)
    {
        if (value <= 0)
        {
            throw new BusinessValidationException($"{fieldName} must be greater than zero.");
        }
    }

    public static void EnsureAtMost(decimal value, decimal maximum, string fieldName)
    {
        if (value > maximum)
        {
            throw new BusinessValidationException(
                $"{fieldName} cannot be greater than {maximum.ToString(CultureInfo.InvariantCulture)}.");
        }
    }

    public static void EnsureNonNegative(decimal value, string fieldName)
    {
        if (value < 0)
        {
            throw new BusinessValidationException($"{fieldName} cannot be negative.");
        }
    }
}
