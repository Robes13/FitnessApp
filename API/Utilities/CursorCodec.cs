using System.Globalization;
using System.Text;

namespace FitnessApp.Api.Utilities;

public static class CursorCodec
{
    public static string Encode(DateTime timestamp, int id)
    {
        var utcTimestamp = timestamp.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(timestamp, DateTimeKind.Utc)
            : timestamp.ToUniversalTime();
        var payload = $"{utcTimestamp.Ticks.ToString(CultureInfo.InvariantCulture)}:{id.ToString(CultureInfo.InvariantCulture)}";
        return ToBase64Url(Encoding.UTF8.GetBytes(payload));
    }

    public static bool TryDecode(string? cursor, out DateTime timestamp, out int id)
    {
        timestamp = default;
        id = default;

        if (string.IsNullOrWhiteSpace(cursor))
        {
            return false;
        }

        try
        {
            var payload = Encoding.UTF8.GetString(FromBase64Url(cursor));
            var parts = payload.Split(':', 2);

            if (parts.Length != 2
                || !long.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out var ticks)
                || !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out id)
                || id <= 0)
            {
                return false;
            }

            timestamp = new DateTime(ticks, DateTimeKind.Utc);
            return true;
        }
        catch (Exception exception) when (exception is FormatException or ArgumentOutOfRangeException)
        {
            return false;
        }
    }

    public static string EncodeId(int id)
    {
        return ToBase64Url(Encoding.UTF8.GetBytes(id.ToString(CultureInfo.InvariantCulture)));
    }

    public static bool TryDecodeId(string? cursor, out int id)
    {
        id = default;

        if (string.IsNullOrWhiteSpace(cursor))
        {
            return false;
        }

        try
        {
            var payload = Encoding.UTF8.GetString(FromBase64Url(cursor));
            return int.TryParse(payload, NumberStyles.Integer, CultureInfo.InvariantCulture, out id) && id > 0;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    private static string ToBase64Url(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] FromBase64Url(string value)
    {
        var base64 = value.Replace('-', '+').Replace('_', '/');
        base64 = base64.PadRight(base64.Length + ((4 - base64.Length % 4) % 4), '=');
        return Convert.FromBase64String(base64);
    }
}
