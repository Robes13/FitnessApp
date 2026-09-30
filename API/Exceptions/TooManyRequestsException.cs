namespace FitnessApp.Api.Exceptions;

public sealed class TooManyRequestsException(string message) : Exception(message);
