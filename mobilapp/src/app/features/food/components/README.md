# Mad – komponenter

Feature-specifikke komponenter til Mad-skærmen. Genbrugelige byggeklodser (ark, knapper,
vare-vælgeren og scanneren) ligger i `shared/components/`.

| Mappe                                           | Komponent                                                       |
| ----------------------------------------------- | --------------------------------------------------------------- |
| [`food-meal-group/`](food-meal-group/README.md) | `FoodMealGroup` — én måltidsgruppe med varer og tilføj-link.    |
| [`food-add-sheet/`](food-add-sheet/README.md)   | `FoodAddSheet` — "Tilføj mad"-arket med chips, faner og vælger. |

Begge er rene præsentationskomponenter: de ændrer ikke loggen, men rapporterer til `FoodPage`.
