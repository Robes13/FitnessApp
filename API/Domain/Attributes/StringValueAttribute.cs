namespace FitnessApp.Api.Domain.Attributes;

[AttributeUsage(AttributeTargets.Field)]
public sealed class StringValueAttribute(string value) : Attribute
{
    public string Value { get; } = value;
}
