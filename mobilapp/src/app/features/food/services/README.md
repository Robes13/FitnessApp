# Mad – services

| Fil            | Indhold                                                |
| -------------- | ------------------------------------------------------ |
| `food-view.ts` | `FoodViewService` — de afledte værdier på Mad-skærmen. |

`FoodViewService` samler designets `kcalRing`, `macros` og `meals`: dagens label, kaloriemål,
spist, tilbage (og ringens andel), de tre makrokort og de fire måltidsgrupper.

Servicen ejer ingen state. Den læser `FoodLogService` og `AdaptiveGoalService` (det tilpassede kaloriemål) og regner videre
med `computed()`, så `FoodPage` kun indeholder præsentation. Den provides på ruten
(`FOOD_ROUTES`), fordi værdierne kun bruges af denne feature — ikke `providedIn: 'root'`.

`kcalRemaining` kan være negativ (mål minus spist) og bruges af scannerens verdict;
`kcalLeft` er den samme værdi klemt fast på 0, som skærmen viser.
