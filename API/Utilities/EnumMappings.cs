using FitnessApp.Api.Domain.Enums;
using FitnessApp.Api.Exceptions;

namespace FitnessApp.Api.Utilities;

public static class EnumMappings
{
    public static ServingUnit ToServingUnit(this QuantityUnit unit)
    {
        return unit switch
        {
            QuantityUnit.Gram => ServingUnit.Gram,
            QuantityUnit.Milliliter => ServingUnit.Milliliter,
            QuantityUnit.Piece => ServingUnit.Piece,
            QuantityUnit.Slice => ServingUnit.Slice,
            QuantityUnit.Cup => ServingUnit.Cup,
            QuantityUnit.Tablespoon => ServingUnit.Tablespoon,
            QuantityUnit.Teaspoon => ServingUnit.Teaspoon,
            QuantityUnit.Serving => ServingUnit.Serving,
            _ => throw new BusinessValidationException($"Unsupported quantity unit: {unit}.")
        };
    }
}
