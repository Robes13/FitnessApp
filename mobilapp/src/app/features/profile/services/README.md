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

Derudover ligger **Dagligt kaloriemål** sidst i listen. Det er API'ets mål
(`UserProfileService.targets().kcal`, plan-v2 P7) og kan ikke redigeres: rækken har
`editable: false`, og siden viser hverken chevron eller ark. Har API'et løftet målet til sin
sikre minimumsgrænse (`calorieFloorApplied`), står der fx `1.200 kcal · sikkert minimum`.
**Fødselsdato** viser dato og alder (`16. maj 1998 · 28 år`).

## Gem

`applyOption`, `applyNumber`, `applyGoalWithGoalWeight`, `applyBirthday` og `applyEmail` gemmer
gennem `UserProfileService.save()` og returnerer en `Observable` (pessimistisk: profilen ændres,
når API'et har svaret). En værdi, der bryder rækkens regler, sendes aldrig – observablen
completer så uden at emitte. Fejl er API'ets `ApiError`; arket vælger teksten.

- **Fødselsdato** er en `date`-definition med `min`/`max` fra `MIN_AGE`/`MAX_AGE` (API'ets 13–100
  år); `isBirthdayValid()` bruges både af arket og af `applyBirthday`.
- **E-mail** sendes trimmet til `PATCH me`; profilen beholder den gamle adresse, til linket i
  mailen er trykket.
- **Træningsdage** sendes som antal; profilen viser dem som de første N ugedage
  (`trainingDaysFor`).

## Grænser i redigeringsarket

Højdefeltet bruger designets egne grænser (120–230 cm), som er snævrere end linealen i
opret-flowet (`HEIGHT_MIN_CM`/`HEIGHT_MAX_CM` = 100–250). Det er bevidst: feltet skrives med
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
`null`. `applyNumber('goalWeight', …)` sender intet for en ugyldig værdi.

**Skift af mål:** Vælger brugeren "Tabe mig"/"Tage på", og passer den gemte målvægt ikke til
det nye mål, gemmes målet **ikke**. `applyOption` returnerer
`{ kind: 'needs-goal-weight', goal }`, arket skifter til målvægtsfeltet med en forklaring, og
først når en gyldig målvægt gemmes, skrives mål og målvægt samlet med
`applyGoalWithGoalWeight()`. Lukkes arket, beholdes det gamle mål. "Holde vægten" gemmes
altid straks (med den nuværende vægt og tempo 0, som API'et kræver) og skjuler Målvægt og Tempo.

## Præstationer

`AchievementsService` regner de tolv badges ud af brugerens egne data: madloggen, vejningerne,
egne samlinger og antallet af scanninger. Der er ingen forspring og ingen syntetisk uge, så
gitteret starter på tolv tomme ringe. Præstationerne læser endnu kun dagens madlog, så
streaks kan højst blive 1. Madloggen har nu historik (`FoodLogService.dailyTotals`), og det er
dér, streaks skal hentes fra.
