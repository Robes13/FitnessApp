using System.Reflection;
using FitnessApp.Api.Domain.Attributes;
using FitnessApp.Api.Domain.Enums;

namespace FitnessApp.Api.Utilities;

public static class AchievementMetadata
{
    public static string GetName(AchievementType type)
    {
        return GetAttribute<StringValueAttribute>(type)?.Value ?? type.ToString();
    }

    public static int GetCompletionRequirement(AchievementType type)
    {
        return GetAttribute<CompletionRequirementAttribute>(type)?.Value ?? 0;
    }

    private static TAttribute? GetAttribute<TAttribute>(AchievementType type)
        where TAttribute : Attribute
    {
        var member = typeof(AchievementType).GetMember(type.ToString()).Single();
        return member.GetCustomAttribute<TAttribute>();
    }
}
