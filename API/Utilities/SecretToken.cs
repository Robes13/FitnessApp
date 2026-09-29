using System.Security.Cryptography;
using System.Text;

namespace FitnessApp.Api.Utilities;

public static class SecretToken
{
    public static string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
