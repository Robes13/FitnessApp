# Konstanter

Alle faste værdier, appen deler. Ingen strengliteraler eller magiske tal andre steder.

| Fil                   | Indhold                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-route.ts`        | `APP_ROUTE` (route-segmenter), `APP_PATH` (absolutte stier, inkl. `recipe(id)`), `ROUTE_PARAM`, `QUERY_PARAM`.                                                                                             |
| `route-data.ts`       | `ROUTE_DATA` – nøgler i en rutes `data`; `HIDE_TAB_BAR` skjuler tab baren på den dybeste aktive rute (opskriftsiden).                                                                                      |
| `storage-key.ts`      | `STORAGE_KEY` – nøgler i `localStorage` (`nutrify.<navn>`) og typen `StorageKey`.                                                                                                                          |
| `meals.ts`            | `MEAL_IDS`, `MEALS` (Morgenmad, Frokost, Aftensmad, Snacks) og `MEAL_TONES` (designets `mealTints`, delt af Mad og Samlinger).                                                                             |
| `nutrition.ts`        | Mål (`GOALS`), tempi (`PACES`), aktivitetsniveauer (`ACTIVITY_LEVELS`), intensiteter (`INTENSITIES`), køn, enheder samt alle grænser og faktorer (vægt/højde/skridt/kcal, BMR-konstanter, makrofordeling). |
| `collection-icons.ts` | De 30 ikon-navne en samling kan have (`COLLECTION_ICON_NAMES`), deres danske navne til skærmlæsere (`COLLECTION_ICON_LABELS`) og hvor mange der vises som standard.                                        |
| `demo-data.ts`        | Designets syntetiske data: `FOOD_DATABASE`, `RECIPES`, `BASE_COLLECTIONS`, `DEMO_LOGGED_FOODS`, `SCANNED_DEMO_ITEM`, `DEMO_PROFILE_DEFAULTS`, `DEMO_WEIGHT_SEED`, `DEFAULT_DISPLAY_NAME`.                  |
| `weight.ts`           | Vægt-intervaller (`1u`/`4u`/`3m`), deres labels og parametrene til den syntetiske vægtkurve.                                                                                                               |
| `theme.ts`            | Standardtema (`dark`) og attributnavnet på `<html>`.                                                                                                                                                       |
| `auth.ts`             | Brugerrettede fejltekster fra mock-backenden.                                                                                                                                                              |

## Beslutninger

- Tekster er kopieret ordret fra designet (`logic.js`), inkl. typografiske tegn som `–` og `·`.
- `ACTIVITY_LEVELS` vælges som _første_ niveau, hvor `skridt < maxSteps` – præcis som designets
  `actLevels.find(a => steps < a.max)`.
- `INTENSITIES` mappes fra RPE som _første_ niveau, hvor `rpe <= maxRpe`.
- Demo-data har faste id'er (`food-havregryn`, `demo-skyr-bowl`, `c1`…), så de kan genkendes
  i tests og historik.
