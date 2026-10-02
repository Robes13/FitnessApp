# ProfileStepSync

`app-profile-step-sync` – rækken "Skridt fra Apple Sundhed" (iOS) / "Skridt fra Health Connect"
(Android) under Profil → Privatliv (spec 2.6 og 9.2-3a). Ingen inputs eller outputs: den læser og
ændrer `StepSyncService` direkte.

- Vises kun, når `StepSyncService.available` er sand – i browseren er den tom.
- **Kontakten** (`app-ui-switch`) er pessimistisk: under `enable()` / `disable()` viser den værdien,
  der gemmes, og er låst; den er også låst, mens storen indlæses eller synkroniserer.
- **Til**: `enable()` – systemets dialog, samtykket gives, og skridtene hentes med det samme.
  Afvises adgangen, springer den tilbage, og linjen under siger hvorfor og hvor adgangen gives.
- **Fra**: åbner `app-ui-confirm-sheet` ("Slå skridt fra?", aktivitetsniveauet skal nu rettes
  manuelt). Kontakten står på fra, mens arket er åbent, og på til igen ved "Annuller". "Ja, slå
  fra" kalder `disable()`; arket er optaget, til API'et har svaret. En fejl lukker arket og vises
  under rækken.
- **Statuslinjen** (`app-ui-form-error`) under forklaringen: en fejl fra kontakten, ellers "Vi
  kunne ikke hente din indstilling for skridt." (storens `load()` fejlede), ellers – når den er slået
  til – "Henter …", "Ikke nok skridtdata endnu …", "Nutrify kan ikke se nogen skridt …" (iOS, hvor
  en nægtet læsning bare ikke giver data), "… giv adgang i …", "Vi kunne ikke hente …" eller den
  seneste synkronisering ("Hentet d. 1. okt – 7.432 skridt om dagen").
- **Knappen under linjen:**
  - "Prøv igen", når `load()` fejlede: kontakten er låst, fordi til eller fra er ukendt, og knappen
    kalder `load()` igen (ikke afbrudt, hvis rækken forsvinder – ellers stod storen fast på
    `loading`).
  - "Giv adgang" ved 2.6-4a (slået til, men sundhedsdataene nægter læsning): samme forløb som at slå
    til (`enable()`). På iOS er det den eneste vej, når appen aldrig har vist HealthKits ark på
    telefonen (geninstalleret, ny telefon) – så står Nutrify ikke under Sundhed → Dataadgang.
  - "Åbn Health Connect" (kun Android), når en anmodning lige er afvist: efter to afvisninger
    viser Health Connect ikke sin dialog igen, så adgangen kan kun gives i dens indstillinger
    (`StepSyncService.openSettings()`). Trykket fjerner fejllinjen.
- **Tilbage i appen** (`visibilitychange` → `visible`): er rækken slået til, men uden adgang eller
  skridt (`no-permission` / `no-steps`), kaldes `load()` igen, så en adgang givet i Health Connect
  eller Indstillinger slår igennem uden genstart; fejllinjen fra sidste forsøg forsvinder.

Teksterne ligger under `profile.stepSync.*` og `core.stepSync.*`; kildens navn (Apple Sundhed /
Health Connect) og tallene 7 og 28 interpoleres fra `core/constants/step-sync.ts`.
