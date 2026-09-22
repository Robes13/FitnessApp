# Profil – services

Feature-specifik logik bag profilskærmen. Alt læses fra `core/`-stores via signals; ingen af
disse services har egen state.

| Fil               | Indhold                                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile-rows.ts` | `ProfileRowsService` – rækkerne under "Min plan" og "Konto" samt de tre nøgletal (vægt, højde, BMI). Designets `profileRows` / `accountRows`.               |
| `profile-edit.ts` | `ProfileEditService` – definitionerne bag "Rediger profil"-arket (titel, felttype, grænser, hjælpetekst) og handlingerne, der gemmer. Designets `editDefs`. |
| `achievements.ts` | `AchievementsService` – de 12 præstationer. Designets `badges`.                                                                                             |

## Betingede rækker

"Min plan" er ikke en fast liste. Præcis som i designet vises

- **Målvægt** kun, når målet er valgt og ikke er `hold`,
- **Tempo** ikke, når målet er `hold` (som i opret-flowet, hvor tempo ikke ændrer målet), og
- **Længde** + **Intensitet** kun, når brugeren har mindst én træningsdag.

Derudover ligger **Dagligt kaloriemål** sidst i listen. Rækken findes ikke i designets
`profileRows`, men designets `editDefs.kcal` gør – den skriver `kcalOverride`, så brugeren kan
overstyre det beregnede mål.

Værdien er det tilpassede mål fra `AdaptiveGoalService.kcalTarget`. Flytter vægtudviklingen
målet, viser rækken også hvor meget, fx `2.410 kcal · tilpasset −120`; uden tilpasning (for lidt
data eller et manuelt mål) står kun kcal. Redigeringsarkets hint skriver det fulde
`Beregnet forslag: … kcal (tilpasset −120 kcal ud fra din vægtudvikling)`. Begge viser den
tilpasning, der faktisk slår igennem efter 1200 kcal-gulvet (`adjustmentKcal` /
`suggestedAdjustmentKcal`), og skjuler den, når den er 0.

## Grænser i redigeringsarket

Højdefeltet bruger designets egne grænser (120–230 cm), som er snævrere end linealen i
opret-flowet (`HEIGHT_MIN_CM`/`HEIGHT_MAX_CM` = 55–250). Det er bevidst: feltet skrives med
tastaturet, hvor et urealistisk tal ellers er nemt at ramme. Alle andre grænser kommer fra
`core/constants/nutrition.ts`.

## Målvægt

Målvægten følger de samme regler som opret-flowets `goal-weight`-trin, og logikken ligger
allerede i `core/` (`NutritionCalculator.goalWeightBounds` og `isGoalWeightRealistic`), så den
genbruges direkte:

- Ved "Tabe mig" skal målvægten være **under** vægten i dag, ved "Tage på" **over**.
  Feltets `min`/`max` er samme skala som linealen i opret-flowet.
- Et urealistisk BMI (under 17 ved tab, over 35 ved at tage på) blokerer "Gem" med samme
  advarsel som i opret-flowet.

`goalWeightError(kg, goal?)` returnerer den fejltekst, arket viser under feltet, eller
`null`. `applyNumber('goalWeight', …)` afviser (returnerer `false`) en ugyldig værdi.

**Skift af mål:** Vælger brugeren "Tabe mig"/"Tage på", og passer den gemte målvægt ikke til
det nye mål, gemmes målet **ikke**. `applyOption` returnerer
`{ kind: 'needs-goal-weight', goal }`, arket skifter til målvægtsfeltet med en forklaring, og
først når en gyldig målvægt gemmes, skrives mål og målvægt samlet med
`applyGoalWithGoalWeight()`. Lukkes arket, beholdes det gamle mål. "Holde vægten" gemmes
altid straks og skjuler Målvægt og Tempo.

## Adgangskode

Adgangskoden er ikke en del af `UserProfile`. "Ny adgangskode" sendes derfor til
`AuthApi.resetPassword()` – backenden er det eneste sted, en adgangskode kan ændres – og
arket viser spinner og fejltekst fra det kald.

## Præstationer

`AchievementsService` regner de tolv badges ud af brugerens egne data: madloggen, vejningerne,
egne samlinger og antallet af scanninger. Der er ingen forspring og ingen syntetisk uge, så
gitteret starter på tolv tomme ringe. Præstationerne læser endnu kun dagens madlog, så
streaks kan højst blive 1. Madloggen har nu historik (`FoodLogService.dailyTotals`), og det er
dér, streaks skal hentes fra.
