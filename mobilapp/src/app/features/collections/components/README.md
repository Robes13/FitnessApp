# Komponenter (samlinger)

Feature-specifikke komponenter. Alt, der kunne bruges af andre features, hører hjemme i
`shared/` i stedet.

| Mappe                   | Komponent                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `meal-picker/`          | `MealPicker` – de fire måltider som 2×2-gitter (designets `newColMeals`/`recipeMealPicks`).   |
| `new-collection-sheet/` | `NewCollectionSheet` – arket "Ny samling" / "Rediger samling" med kladde, søgning og scanner. |

Bekræftelsen før en samling slettes er den fælles `shared/components/ui-confirm-sheet`.
