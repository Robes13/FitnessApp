using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Utilities;

public static class UsernameRules
{
    public const string Pattern = "^[A-Za-z0-9_-]{3,50}$";

    // ASCII folding matches the database-generated value exactly, including legacy names.
    public static string Normalize(string username) => string.Concat(username.Select(character =>
        character is >= 'A' and <= 'Z' ? (char)(character + ('a' - 'A')) : character));

    public static string Validate(string username)
    {
        if (string.IsNullOrEmpty(username) || username.Length is < 3 or > 50
            || username.Any(character => !char.IsAsciiLetterOrDigit(character) && character != '_' && character != '-'))
            throw new BusinessValidationException("Username must contain 3-50 letters, numbers, underscores or hyphens, with no whitespace.");
        return username;
    }
}
