namespace FitnessApp.Api.Domain.Attributes;

[AttributeUsage(AttributeTargets.Field)]
public sealed class CompletionRequirementAttribute(int value) : Attribute
{
    public int Value { get; } = value;
}
