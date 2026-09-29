namespace FitnessApp.Api.Exceptions;

public sealed class WeightDateConflictException(int existingWeightLogId)
    : Exception("A weight entry already exists for this calendar day.")
{
    public int ExistingWeightLogId { get; } = existingWeightLogId;
}
