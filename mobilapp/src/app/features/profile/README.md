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

Profilen kommer fra API'et (`UserProfileService`, se [`core/services/README.md`](../../core/services/README.md)).
Mens den hentes, viser siden en spinner i stedet for profilens egne data (hoved, nøgletal, "Min
plan", e-mail); fejler den, en besked og "Prøv igen" (`profiles.load()`). Tema, sprog,
notifikationer, påmindelser, log ud og slet konto kan bruges hele tiden.

## Skærmens dele

1. **Hoved** – avatar 72 px med en orange blyant i hjørnet, navn (30 px display, afkortes) og
   e-mail. Blyanten åbner fotoarket.
2. **Nøgletal** – tre fliser: Vægt (orange), Højde og BMI.
3. **Min plan** – Mål, [Tempo], Fødselsdato, Køn, Højde, [Målvægt], Aktivitet, Træningsdage,
   [Længde], [Intensitet] og Dagligt kaloriemål (API'ets, kan ikke redigeres). De fire i kantede
   parenteser er betingede; se [`services/README.md`](services/README.md).
4. **Konto** – E-mail, kontakterne "Lys tilstand" og
   "Notifikationer" samt rækken "Påmindelser", der åbner påmindelses-arket.
5. **Præstationer** – 12 badges i fire kolonner.
6. **Log ud** – rød tekst i en omrids-pille, der åbner bekræftelsen.
7. **Slet konto** – en diskret tekstknap under "Log ud", der åbner sin egen bekræftelse.

Hver række – undtagen kaloriemålet, der hverken har chevron eller ark – åbner det samme
redigeringsark; arket finder selv ud af, om rækken er en liste, et tal, en dato eller en tekst.
Alt gemmes i API'et, og profilen ændres først, når API'et har svaret. Adgangskoden kan ikke ændres herfra – det sker via "Glemt
adgangskode?" på login-siden.

## Tema, sprog og notifikationer

"Lys tilstand" styrer `ThemeService` (ikke profilen): den sætter `data-theme` på `<html>` og
husker valget. "Notifikationer" er **hovedkontakten** for påmindelser: den går gennem
`ReminderService.setMasterEnabled()`, som sætter `notificationsEnabled` på profilen og – når
den slås til – beder om lov til notifikationer. (Den skal gemme via
`UserProfileService.save({ notificationsEnabled })` = `PUT me/settings/Notifications`; det kobler
profile-extras på i bølge 3.) Begge er almindelige `app-ui-switch`.

"Sprog" er en `app-ui-segmented-control` (compact) med Dansk/English. Valget går til
`LanguageService.set()`, som gemmer det og genindlæser appen på det nye sprog.

## Påmindelser

Rækken "Påmindelser" viser "Fra" (hovedkontakten er slået fra), "Ingen" eller antallet af
aktive påmindelser, og åbner `profile-reminders-sheet`. Arket vælger, hvilke påmindelser
brugeren vil have (morgenmad, frokost, aftensmad, vejning og "Husk at logge dagens mad"),
og deres tidspunkt. Selve planlægningen af lokale notifikationer ligger i
`core/services/reminders/reminders.ts`; se [`core/services/README.md`](../../core/services/README.md).

## Log ud

Bekræftelsen kalder `SessionService.logout()` (tilbagekalder refresh-tokenet i API'et med et
friskt access-token) og navigerer til `APP_PATH.LOGIN`, når kaldet er færdigt. Imens viser
"Ja, log mig ud" en spinner (`busy`). Log ud er _best effort_: kan API'et ikke nås, slutter
sessionen alligevel lokalt, så der er ingen fejltilstand. Kun sessionen ryddes – brugerens data
ligger i API'et, som designets tekst lover: "Dine data bliver gemt."

## Slet konto

Kravet kommer fra GDPR: brugeren skal selv kunne slette sine data. Bekræftelsen
(`profile-delete-account-sheet`) forklarer, at kontoen og **alle** data slettes, og kalder
derefter `SessionService.deleteAccount()`, som

1. sletter kontoen i API'et (`DELETE /me` – anonymiserer brugeren og sletter alle data),
2. **kun hvis det lykkes**: sletter alle appens nøgler i storage (`StorageService.clearAll()`,
   der fjerner alle nøgler med `STORAGE_KEY_PREFIX`), og
3. genindlæser appen på login-siden (`document.location.replace`).

Mens kaldet kører, viser "Ja, slet min konto" en spinner, og "Annuller" er slået fra. Fejler
det, slettes intet lokalt, og arket viser fejlen i en `UiFormError`.

Genindlæsningen er et bevidst valg: madlog, vejninger, samlinger, tema m.fl. ligger i hver
sin root-store, og en fuld genindlæsning nulstiller dem alle på én gang. Sessionen ændres ikke
i hukommelsen inden, så ingen store når at reagere og skrive til storage igen.

## Profilbilledet

Billedet ligger på profilen som `ProfilePhoto` (data-URL eller API'ets `profileImageUrl`,
billedformat, zoom, x, y – indtil upload kommer i bølge 3 kun i hukommelsen) og
tegnes som `background-size` / `background-position` i **procent**. Derfor viser
196 px-editoren, 132 px-forhåndsvisningen, 72 px-avataren og Hjems 44 px-avatar nøjagtig
samme udsnit. Både komponenten og formlerne ligger i `shared/components/profile-avatar/`,
fordi Hjem viser den samme avatar.

## Typer

Feature-typerne (`ProfileRow`, `ProfileEditDefinition`, `Achievement` …) er eksporteret fra
den service, der producerer dem, i stedet for at ligge i en `models/`-mappe. De giver kun
mening sammen med den service, og der er ingen af dem, to services deler.
