using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Utilities;

public static class RequestGuards
{
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

    public static void EnsureNonNegative(decimal value, string fieldName)
    {
        if (value < 0)
        {
            throw new BusinessValidationException($"{fieldName} cannot be negative.");
        }
    }
}
