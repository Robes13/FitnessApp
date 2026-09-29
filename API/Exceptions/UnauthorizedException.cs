namespace FitnessApp.Api.Exceptions;

public sealed class UnauthorizedException(string message) : Exception(message);
