# Konstanter

Alle faste værdier, appen deler. Ingen strengliteraler eller magiske tal andre steder.

| Fil                   | Indhold                                                                                                                                                                                                                                                                                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-route.ts`        | `APP_ROUTE` (route-segmenter), `APP_PATH` (absolutte stier, inkl. `recipe(id)`), `ROUTE_PARAM`, `QUERY_PARAM`.                                                                                                                                                                                                                                                       |
| `route-data.ts`       | `ROUTE_DATA` – nøgler i en rutes `data`; `HIDE_TAB_BAR` skjuler tab baren på den dybeste aktive rute (opskriftsiden).                                                                                                                                                                                                                                                |
| `storage-key.ts`      | `STORAGE_KEY` – nøgler i `localStorage` (`nutrify.<navn>`) og typen `StorageKey`.                                                                                                                                                                                                                                                                                    |
| `meals.ts`            | `MEAL_IDS`, `MEALS` (Morgenmad, Frokost, Aftensmad, Snacks) og `MEAL_TONES` (designets `mealTints`, delt af Mad og Samlinger).                                                                                                                                                                                                                                       |
| `nutrition.ts`        | Mål (`GOALS`), tempi (`PACES`), aktivitetsniveauer (`ACTIVITY_LEVELS`), intensiteter (`INTENSITIES`), køn, enheder samt alle grænser og faktorer (vægt/højde/skridt/kcal, BMR-konstanter, makrofordeling, træning-MET og adaptivt mål).                                                                                                                              |
| `collection-icons.ts` | De 30 ikon-navne en samling kan have (`COLLECTION_ICON_NAMES`), deres danske navne til skærmlæsere (`COLLECTION_ICON_LABELS`) og hvor mange der vises som standard.                                                                                                                                                                                                  |
| `profile-defaults.ts` | `DEFAULT_PROFILE` – profilen før brugeren har udfyldt noget – og linealernes neutrale startværdier (`WEIGHT_START_KG`, `HEIGHT_START_CM`, `GOAL_WEIGHT_START_KG`).                                                                                                                                                                                                   |
| `weight.ts`           | Vægt-intervaller (`1u`/`4u`/`3m`), deres labels `WEIGHT_LOG_HISTORY_RANGE` (vejningslisten viser højst 3 mdr. tilbage) og vejningslistens tekster (`WEIGHT_LOG_LIST_TEXT`).                                                                                                                                                                                          |
| `reminders.ts`        | `REMINDER_DEFINITIONS` (label, notifikationstekst, fast id og standardtid pr. type), `DEFAULT_REMINDER_SETTINGS`, `REMINDER_IDS`, `REMINDER_NOTIFICATION_IDS` og `REMINDER_ERROR`. Kun "Dagens madlog" (21:00) er slået til som standard.                                                                                                                            |
| `keyboard.ts`         | `KEYBOARD_CSS` – navnet på CSS-variablen `--keyboard-inset` og attributten `data-keyboard`, som `KeyboardService` sætter på `<html>`. |
| `time.ts`             | Kalender- og urenheder: `DAYS_PER_WEEK`, `HOURS_PER_DAY`, `MINUTES_PER_HOUR`, `MS_PER_DAY` – ét sted, delt af dato-hjælperne, beregningerne og påmindelserne.                                                                                                                                                                                                        |
| `theme.ts`            | Standardtema (`dark`) og attributnavnet på `<html>`.                                                                                                                                                                                                                                                                                                                 |
| `auth.ts`             | Brugerrettede fejltekster fra auth-laget, inkl. `NO_BACKEND`, og `AUTH_ENDPOINT` – backendens auth-endpoints.                                                                                                                                                                                                                                                        |
| `barcode.ts`          | Stregkodens længde og `BARCODE_PATTERN` (8–14 cifre), `OPEN_FOOD_FACTS` (URL, felter, `NUTRITION_PER_100_ML`) + `openFoodFactsProductUrl()`, `KJ_PER_KCAL`, `PRODUCT_BASE_UNIT` (g/ml), `PRODUCT_LOOKUP_TIMEOUT_MS`, cache-grænse, mængdegrænser og -forvalg, pluginets fejlbeskeder (`BARCODE_PLUGIN_ERROR`) og scannerens danske tekster (`BARCODE_SCANNER_TEXT`). |

## Beslutninger

- Tekster er kopieret ordret fra designet (`logic.js`), inkl. typografiske tegn som `–` og `·`.
- `ACTIVITY_LEVELS` vælges som _første_ niveau, hvor `skridt < maxSteps` – præcis som designets
  `actLevels.find(a => steps < a.max)`.
- `INTENSITIES` mappes fra RPE som _første_ niveau, hvor `rpe <= maxRpe`.
- **Træning-MET** (`TRAINING_MET`) er hentet fra _Compendium of Physical Activities_ (Ainsworth
  m.fl. 2011, opdateret af Herrmann m.fl. 2024): mild ≈ 3,5 (rask gang, let cykling), moderat ≈ 5
  (jog, styrke med pauser), hård ≈ 8 (intervaller, tunge løft). Antagelser: 1 MET ≈ 1 kcal/kg/t,
  og hvile-MET'en (`RESTING_MET` = 1) trækkes fra, da BMR × PAL allerede dækker hvile.
- **Adaptivt mål**: `ADAPTIVE_WINDOW_DAYS` = 21, `ADAPTIVE_MIN_LOGGED_DAYS` = 10,
  `ADAPTIVE_MIN_DAY_FRACTION` = 0,5 (en dag under halvdelen af formlens forbrug er kun delvist
  logget og tæller ikke),
  `ADAPTIVE_MIN_WEIGH_INS` = 2, `ADAPTIVE_MIN_WEIGHT_SPAN_DAYS` = 14,
  `ADAPTIVE_MAX_ADJUSTMENT_KCAL` = 300 og `KCAL_PER_KG_BODY_WEIGHT` = 7700 (tommelfingerregel for
  energien i 1 kg kropsvægt). Loftet på ±300 kcal holder en ufuldstændig madlog fra at flytte
  målet for meget.
- **Ingen demo-data.** Appen har hverken varedatabase, retter, faste samlinger eller seedede
  logs. Alt indhold skal komme fra brugeren eller fra backenden.
- `DEFAULT_PROFILE` er ikke et gæt på brugeren: felter, der ikke kan udledes, er `null` eller
  tomme, og tallene er kun det sted, linealerne begynder.
