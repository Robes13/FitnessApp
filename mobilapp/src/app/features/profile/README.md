# Profil

Brugerens egen skærm: hvem man er, hvad planen er, og hvordan det går. Den åbnes fra
avataren på Hjem og ligger **uden for** tab-rammen (`/profil`, `PROFILE_ROUTES`), så den har
ingen tab bar og går tilbage til Hjem.

Designet: `Fitness App.dc.html` linje 1612–1803 (Profil, Log ud, Rediger profil,
Profilbillede). Logikken er portet fra `logic.js`: `profileRows`, `accountRows`, `editDefs`,
`openEdit`, `badges`, `photo*`, `toggleLight`, `toggleNotif`, `logout`.

## Opbygning

```
profile/
├── profile.routes.ts                 PROFILE_ROUTES
├── pages/profile-page/               Skærmen: hoved, nøgletal, rækker, præstationer, log ud, slet konto
├── components/
│   ├── profile-avatar/               Avataren i 72 / 132 / 196 px + beskæringsformlerne
│   ├── achievements/                 Gitteret med de 12 badges
│   ├── profile-edit-sheet/           "Rediger profil" – alle fire feltvarianter
│   ├── profile-photo-sheet/          "Profilbillede" – filvalg, træk og zoom
│   ├── profile-reminders-sheet/      "Dine påmindelser" – typer, tidspunkter og vejedag
│   ├── profile-logout-sheet/         "Log ud?" – bekræftelsen
│   └── profile-delete-account-sheet/ "Slet konto?" – bekræftelsen
└── services/                         Rækker, redigeringsdefinitioner og præstationer
```

Siden ejer kun, hvad der er åbent (`editRow`, `photoOpen`, `remindersOpen`, `logoutOpen`, `deleteAccountOpen`). Alt andet er
afledt af `core/`-stores, så en ændring et andet sted i appen slår igennem med det samme.

## Skærmens dele

1. **Hoved** – avatar 72 px med en orange blyant i hjørnet, navn (30 px display, afkortes) og
   e-mail. Blyanten åbner fotoarket.
2. **Nøgletal** – tre fliser: Vægt (orange), Højde og BMI.
3. **Min plan** – Mål, [Tempo], Køn, Højde, [Målvægt], Aktivitet, Træningsdage, [Længde],
   [Intensitet] og Dagligt kaloriemål. De fire i kantede parenteser er betingede; se
   [`services/README.md`](services/README.md).
4. **Konto** – E-mail, Adgangskode, Enheder, kontakterne "Lys tilstand" og
   "Notifikationer" samt rækken "Påmindelser", der åbner påmindelses-arket.
5. **Præstationer** – 12 badges i fire kolonner.
6. **Log ud** – rød tekst i en omrids-pille, der åbner bekræftelsen.
7. **Slet konto** – en diskret tekstknap under "Log ud", der åbner sin egen bekræftelse.

Hver række åbner det samme redigeringsark; arket finder selv ud af, om rækken er en liste,
et tal, en tekst eller en adgangskode.

## Tema og notifikationer

"Lys tilstand" styrer `ThemeService` (ikke profilen): den sætter `data-theme` på `<html>` og
husker valget. "Notifikationer" er **hovedkontakten** for påmindelser: den går gennem
`ReminderService.setMasterEnabled()`, som skriver `notificationsEnabled` på profilen og – når
den slås til – beder om lov til notifikationer. Begge er almindelige `app-ui-switch`.

## Påmindelser

Rækken "Påmindelser" viser "Fra" (hovedkontakten er slået fra), "Ingen" eller antallet af
aktive påmindelser, og åbner `profile-reminders-sheet`. Arket vælger, hvilke påmindelser
brugeren vil have (morgenmad, frokost, aftensmad, vejning og "Husk at logge dagens mad"),
og deres tidspunkt. Selve planlægningen af lokale notifikationer ligger i
`core/services/reminders.ts`; se [`core/services/README.md`](../../core/services/README.md).

## Log ud

Bekræftelsen kalder `SessionService.logout()` og navigerer til `APP_PATH.LOGIN`. Kun
sessionen ryddes – profil, madlog, vejninger og samlinger bliver liggende, som designets
tekst lover: "Dine data bliver gemt."

## Slet konto

Kravet kommer fra GDPR: brugeren skal selv kunne slette sine data. Bekræftelsen
(`profile-delete-account-sheet`) forklarer, at **alle** data på enheden slettes, og kalder
derefter `SessionService.deleteAccount()`, som

1. nulstiller session og profil i hukommelsen,
2. sletter alle appens nøgler i storage (`StorageService.clearAll()`, der gennemløber
   `STORAGE_KEY`), og
3. genindlæser appen på login-siden (`document.location.replace`).

Genindlæsningen er et bevidst valg: madlog, vejninger, samlinger, tema m.fl. ligger i hver
sin root-store, og en fuld genindlæsning er den eneste måde at nulstille dem alle på én gang
uden at give hver store sin egen reset-metode. Når backenden findes, skal dens
slet-konto-kald ligge i `deleteAccount()`, før de lokale data ryddes.

## Profilbilledet

Billedet gemmes på profilen som `ProfilePhoto` (data-URL, billedformat, zoom, x, y) og
tegnes som `background-size` / `background-position` i **procent**. Derfor viser
196 px-editoren, 132 px-forhåndsvisningen, 72 px-avataren og Hjems 44 px-avatar nøjagtig
samme udsnit. Både komponenten og formlerne ligger i `shared/components/profile-avatar/`,
fordi Hjem viser den samme avatar.

## Typer

Feature-typerne (`ProfileRow`, `ProfileEditDefinition`, `Achievement` …) er eksporteret fra
den service, der producerer dem, i stedet for at ligge i en `models/`-mappe. De giver kun
mening sammen med den service, og der er ingen af dem, to services deler.
