# Signup – services

| Fil                    | Indhold                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `signup-state.ts`      | `SignupStateService` + `SignupStepId`, `SIGNUP_STEP_ORDER`, `SignupChapter`, `SKIP_PACE_FOR_MAINTAIN`. |
| `signup-state.spec.ts` | Rækkefølge, spring-regler, `canContinue` pr. trin, knaptekster, kapitler, rette-kæder og oprettelse.   |

`SignupStateService` er **ikke** `providedIn: 'root'`. Den leveres af `SignupPage`
(`providers`), så kladden – adgangskoden med – lever præcis lige så længe som siden: forlader
brugeren oprettelsen (også efter en oprettet konto eller et log ud), er alt væk næste gang.
Ikke på ruten: Angular beholder en rutes injector, når brugeren går væk.

## Offentlig API

- **Kladde** (skrivbare signaler, sat af trinnene): `username`, `password`, `passwordRepeat`,
  `birthday`, `gender`, `weightKg`, `heightCm`, `stepsPerDay`, `trainingDays`,
  `trainingMinutes`, `trainingRpe`, `goal`, `goalWeightKg`, `pace`, `notifications`, `email`,
  `termsAccepted`. Startværdierne kommer fra `DEFAULT_PROFILE`, så kladden begynder tom.
  `emailInvalid` er sand, når der står noget i `email`, som ikke er en e-mail (ikke i det tomme
  felt) – opsummeringen markerer feltet, og siden forklarer det.
- **Navigation**: `step`, `editFrom`, `isEditing`, `visibleOrder`, `stepNumber`, `stepTotal`,
  `progressValue`, `chapters`, `canContinue`, `nextLabel`, `next()`, `back()`,
  `jumpTo(step)`, `toggleTrainingDay(index)`.
- **Afslutning**: `submit(): Observable<void>`.

`next()` gør bevidst ingenting på `summary` – dér hedder knappen "Opret konto", og
`SignupPage` kalder `submit()`, fordi den også skal vise spinner og fejl.

## Afledte værdier, trinnene ikke får

Alderen og målvægtens grænser regnes med `NutritionCalculator` (`ageFromBirthday`,
`goalWeightBounds`, `isGoalWeightRealistic`, `isValidEmail`) og bruges kun internt i
`canContinue` og i profilen. Har et trin brug for de samme tal til sin visning, injicerer det
selv `NutritionCalculator` – logikken må ikke skrives to gange.
