# Mad – services

| Fil            | Indhold                                                |
| -------------- | ------------------------------------------------------ |
| `food-view.ts` | `FoodViewService` — de afledte værdier på Mad-skærmen. |

`FoodViewService` samler designets `kcalRing`, `macros` og `meals`: dagens label, kaloriemål,
spist, tilbage (og ringens andel), de tre makrokort og de fire måltidsgrupper.

Servicen ejer ingen state. Den læser `FoodLogService` og `UserProfileService.targets` (API'ets kalorie- og makromål) og regner videre
med `computed()`, så `FoodPage` kun indeholder præsentation. Den provides på ruten
(`FOOD_ROUTES`), fordi værdierne kun bruges af denne feature — ikke `providedIn: 'root'`.

`kcalRemaining` kan være negativ (mål minus spist) og bruges af scannerens verdict;
`kcalLeftText` er den samme værdi klemt fast på 0, som skærmen viser, og `eatenOfGoalText` er
linjen under (`'2.430 spist · mål 2.384'`). Loggen har API'ets præcise værdier, så `kcalEaten` og
måltidernes kcal er summen afrundet til hele kcal (rækkerne afrundes hver for sig i
`FoodMealGroup`); makrokortene viser højst én decimal (`formatGrams`). Alle kcal-tal på skærmen
går gennem `formatInteger`, så de har tusindtalsseparator som på Hjem (`'2.384'`).
