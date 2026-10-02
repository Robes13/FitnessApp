# ProfilePage

`app-profile-page` – profilskærmen på `/profil`.

| Fil                    | Indhold                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `profile-page.ts`      | Komponenten. Holder kun styr på, hvilket ark der er åbent.                                                                  |
| `profile-page.html`    | Status (spinner / fejl + "Prøv igen"), hoved, nøgletal, "Min plan", "Konto", præstationer, "Privatliv", "Log ud" og arkene. |
| `profile-page.scss`    | Sidens eget layout. Rækker, kort og ark kommer fra `shared/`.                                                               |
| `profile-page.spec.ts` | Dækker rækkerne, kontakterne (inkl. gem/fejl), påmindelses-arket, redigeringsarket, privatliv, log ud og slet konto.        |

## Layout

`:host` bruger mixinen `page-screen` (flex-kolonne, fuld højde, notch-padding), og indholdet
ligger i et `scroll-area` med sidepadding. Siden er **ikke** en fane, så der er ingen
friplads til tab baren i bunden – kun designets 24 px.

Sidehovedet er `app-ui-page-header` med en tilbage-knap, der går til Hjem.

## State

Komponenten ejer, hvilket ark der er åbent: `editRow`, `photoOpen`, `remindersOpen`,
`logoutOpen` og `deleteAccountOpen` (+ `withdrawingConsent`: slet-arket er åbnet fra "Træk
tilbage" på samtykkerækken og viser `withdrawBody`) – plus kaldene, den venter på:
`loggingOut`, `deletingAccount`, `downloadingData` og den værdi, "Notifikationer" er ved at gemme
(`savingNotifications`). Fejl gemmes som oversættelsesnøgler (`deleteErrorKey`,
`downloadErrorKey`, `notificationsErrorKey`), så de følger et sprogskift.
Log ud navigerer til login, når `SessionService.logout()` er færdig; slet konto og træk samtykke
tilbage lader arket stå med spinner, indtil appen genindlæses, og viser fejlen i arket, hvis
API'et afviser.

"Notifikationer" er pessimistisk: kontakten viser den nye stilling og er låst, mens
`ReminderService.setMasterEnabled()` gemmer (`PUT me/settings/Notifications`); fejler det,
springer den tilbage, og fejlen står under den. "Download mine data" er slået fra, mens
`PrivacyService` (leveret af siden) henter eksport-tokenet; en fejl står under rækken.
Alle værdier på
skærmen er afledte signaler fra `ProfileRowsService`, `AchievementsService`,
`UserProfileService`, `ReminderService` og `ThemeService`, så de opdaterer sig selv, når data ændrer sig et
andet sted i appen – fx når en ny vejning gemmes på Vægt.

## Indlæsning og fejl

`profiles.status()` styrer toppen af siden: `loading` → `app-ui-spinner`, `error` →
`app-ui-empty-state` + "Prøv igen" (`profiles.load()`), ellers profilens data. E-mail-rækken
følger med (`profileShown`). Kaloriemålet er API'ets: rækken har ingen chevron, og `openEdit`
springer den over.

## Log ud-knappen

Knappen er `app-ui-button` med `variant="outline"`; den røde tekst kommer fra
`.profile-page__logout`. `UiButton` har ikke en variant med omrids **og** rød tekst, og at
farve knappen her er billigere end en ny variant, der kun bruges ét sted.
