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
| `profile-defaults.ts` | `DEFAULT_PROFILE` – profilen før brugeren har udfyldt noget – og linealernes neutrale startværdier (`WEIGHT_START_KG`, `HEIGHT_START_CM`, `GOAL_WEIGHT_START_KG`).                                         |
| `weight.ts`           | Vægt-intervaller (`1u`/`4u`/`3m`) og deres labels.                                                                                                                                                         |
| `theme.ts`            | Standardtema (`dark`) og attributnavnet på `<html>`.                                                                                                                                                       |
| `auth.ts`             | Brugerrettede fejltekster fra auth-laget, inkl. `NO_BACKEND`.                                                                                                                                              |

## Beslutninger

- Tekster er kopieret ordret fra designet (`logic.js`), inkl. typografiske tegn som `–` og `·`.
- `ACTIVITY_LEVELS` vælges som _første_ niveau, hvor `skridt < maxSteps` – præcis som designets
  `actLevels.find(a => steps < a.max)`.
- `INTENSITIES` mappes fra RPE som _første_ niveau, hvor `rpe <= maxRpe`.
- **Ingen demo-data.** Appen har hverken varedatabase, retter, faste samlinger eller seedede
  logs. Alt indhold skal komme fra brugeren eller fra backenden.
- `DEFAULT_PROFILE` er ikke et gæt på brugeren: felter, der ikke kan udledes, er `null` eller
  tomme, og tallene er kun det sted, linealerne begynder.
