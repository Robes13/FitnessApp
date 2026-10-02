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
│   ├── achievements/                 Gitteret med de 12 badges
│   ├── profile-edit-sheet/           "Rediger profil" – alle fire feltvarianter
│   ├── profile-photo-sheet/          "Profilbillede" – filvalg, træk og zoom
│   ├── profile-reminders-sheet/      "Dine påmindelser" – typer, tidspunkter og vejedag
│   ├── profile-step-sync/            "Skridt fra Apple Sundhed / Health Connect" – kontakt, status, slå fra-ark
│   ├── profile-logout-sheet/         "Log ud?" – bekræftelsen
│   └── profile-delete-account-sheet/ "Slet konto?" – bekræftelsen (også ved tilbagetrækning af samtykke)
└── services/                         Rækker, redigeringsdefinitioner, præstationer og dataeksport
```

Siden ejer kun, hvad der er åbent (`editRow`, `photoOpen`, `remindersOpen`, `logoutOpen`,
`deleteAccountOpen` + `withdrawingConsent`), og hvilke kald der kører. Alt andet er afledt af `core/`-stores, så en
ændring et andet sted i appen slår igennem med det samme.

Profilen kommer fra API'et (`UserProfileService`, se [`core/services/README.md`](../../core/services/README.md)).
Mens den hentes, viser siden en spinner i stedet for profilens egne data (hoved, nøgletal, "Min
plan", e-mail); fejler den, en besked og "Prøv igen" (`profiles.load()`). Tema, sprog,
notifikationer, påmindelser, privatliv, log ud og slet konto kan bruges hele tiden.

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
6. **Privatliv** – "Download mine data", samtykkerækken "Servicevilkår og behandling af
   sundheds- og profildata · Træk tilbage" og – kun på en telefon med sundhedsdata – "Skridt fra
   Apple Sundhed" / "Skridt fra Health Connect" (se nedenfor).
7. **Log ud** – rød tekst i en omrids-pille, der åbner bekræftelsen.
8. **Slet konto** – en diskret tekstknap under "Log ud", der åbner sin egen bekræftelse.

Hver række – undtagen kaloriemålet, der hverken har chevron eller ark – åbner det samme
redigeringsark; arket finder selv ud af, om rækken er en liste, et tal, en dato eller en tekst.
Alt gemmes i API'et, og profilen ændres først, når API'et har svaret. Adgangskoden kan ikke ændres herfra – det sker via "Glemt
adgangskode?" på login-siden.

## Tema, sprog og notifikationer

"Lys tilstand" styrer `ThemeService` (ikke profilen): den sætter `data-theme` på `<html>` og
husker valget. "Notifikationer" er **hovedkontakten** for påmindelser: den går gennem
`ReminderService.setMasterEnabled()`, som gemmer den i API'et
(`UserProfileService.save({ notificationsEnabled })` = `PUT me/settings/Notifications`) og – når
den er slået til – beder om lov til notifikationer. Gemningen er pessimistisk: kontakten viser
den nye stilling og er låst, mens kaldet kører; fejler det, springer den tilbage, og fejlen står
under den i en `UiFormError`. Begge er almindelige `app-ui-switch`.

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

## Privatliv (spec 9.1 og 9.2)

**Download mine data** kalder `PrivacyService.downloadMyData()` (`services/privacy.ts`, leveret
af siden): `POST me/data-export/token` giver et token, der gælder i 5 minutter, og appen
navigerer til `GET /api/v1/data-export?token=…` (anonym, JSON som vedhæftet fil). Browseren
downloader filen, og appen bliver stående; på telefonen åbner Capacitor systembrowseren, som
gemmer filen. Tokenet står i query-strengen, aldrig i stien (API'et logger stien ved serverfejl).
Mens tokenet hentes, er rækken slået fra; en fejl vises under den i en `UiFormError`. Capacitors
WebViews kan ikke gemme en blob, og Filesystem/Share ville være nye pakker – derfor navigationen.

**Samtykke:** Ved registreringen gives kun `Terms` (signup-teksten siger, at vilkårene omfatter
behandling af sundheds- og profildata); `HealthDataProcessing` gives aldrig. Vilkårene er **én
statisk række**; det eneste andet samtykke er skridtene (`StepsIntegration`, nedenfor). "Træk tilbage" åbner slet-arket med en egen tekst (`bodyKey`): samtykket
er en forudsætning for appen, så tilbagetrækning sletter kontoen (9.2-3b). Bekræftelsen kalder
`SessionService.withdrawConsent()` (`POST me/consents/Terms/withdraw`), som – ligesom slet konto –
først efter API'ets 204 rydder storage og genindlæser appen på login.

**Skridt fra Apple Sundhed / Health Connect (spec 2.6 og 9.2-3a):** `profile-step-sync` viser en
kontakt med en kort forklaring og den seneste status, kun når `StepSyncService.available` er sand
(aldrig i browseren). Til = `enable()`: systemets tilladelsesdialog → samtykket gives → skridtene
hentes med det samme; afvises adgangen, forbliver den slået fra med en besked. Fra spørger først
(`app-ui-confirm-sheet`: aktivitetsniveauet skal nu rettes manuelt) og kalder så `disable()`, som
trækker samtykket tilbage. Statuslinjen: "Hentet d. … – 7.432 skridt om dagen", "Henter dine
skridt …", "Ikke nok skridtdata endnu …", "Nutrify har ikke adgang til dine skridt – giv adgang i …"
eller "Vi kunne ikke hente dine skridt. Vi prøver igen næste gang." Den sidste vises også på Hjem,
så en bruger, der ikke åbner Profil, hører om det. Ved 4a er der en "Giv adgang"-knap (`enable()`
igen) – på Android "Åbn Health Connect", når en anmodning er afvist – og tilbage i appen indlæser
rækken igen. På iOS siger "Nutrify kan ikke se nogen skridt …", hvor adgangen gives (HealthKit
skjuler en nægtet læsning). Kunne samtykket ikke læses, er kontakten låst med "Prøv igen". Selve
logikken ligger i `core/services/step-sync/` (se [`core/services/README.md`](../../core/services/README.md)).

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

Fotoarket beskærer et valgt billede som en kladde og bager udsnittet ind i en 512 × 512 JPEG
ved "Brug billedet", som uploades med `UserProfileService.uploadPhoto()` (`PUT
me/profile/image`). Profilen har derefter API'ets `profileImageUrl` som `ProfilePhoto`
(kvadratisk, centreret, zoom 1) – i Development en relativ URL (`/api/v1/dev-images/…`), der går
gennem dev-proxyen i browseren og gøres absolut mod API'et på native. Under beskæringen tegnes kladden som `background-size` /
`background-position` i **procent**, så 196 px-editoren viser nøjagtig det udsnit, der bages.
Både avataren og formlerne ligger i `shared/components/profile-avatar/`, fordi Hjem viser den
samme avatar. Se [`components/profile-photo-sheet/README.md`](components/profile-photo-sheet/README.md).

## Typer

Feature-typerne (`ProfileRow`, `ProfileEditDefinition`, `Achievement` …) er eksporteret fra
den service, der producerer dem, i stedet for at ligge i en `models/`-mappe. De giver kun
mening sammen med den service, og der er ingen af dem, to services deler.
