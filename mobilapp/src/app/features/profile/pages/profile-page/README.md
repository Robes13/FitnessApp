# ProfilePage

`app-profile-page` – profilskærmen på `/profil`.

| Fil                    | Indhold                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| `profile-page.ts`      | Komponenten. Holder kun styr på, hvilket ark der er åbent.                   |
| `profile-page.html`    | Hoved, nøgletal, "Min plan", "Konto", præstationer, "Log ud" og de tre ark.  |
| `profile-page.scss`    | Sidens eget layout. Rækker, kort og ark kommer fra `shared/`.                |
| `profile-page.spec.ts` | Dækker rækkerne, kontakterne, påmindelses-arket, redigeringsarket og log ud. |

## Layout

`:host` bruger mixinen `page-screen` (flex-kolonne, fuld højde, notch-padding), og indholdet
ligger i et `scroll-area` med sidepadding. Siden er **ikke** en fane, så der er ingen
friplads til tab baren i bunden – kun designets 24 px.

Sidehovedet er `app-ui-page-header` med en tilbage-knap, der går til Hjem.

## State

Komponenten ejer, hvilket ark der er åbent: `editRow`, `photoOpen`, `remindersOpen`,
`logoutOpen` og `deleteAccountOpen` – plus de to kald, arkene venter på: `loggingOut`,
`deletingAccount` og `deleteErrorKey` (en oversættelsesnøgle, så fejlen følger et sprogskift).
Log ud navigerer til login, når `SessionService.logout()` er færdig; slet konto lader arket
stå med spinner, indtil appen genindlæses, og viser fejlen i arket, hvis API'et afviser.
Alle værdier på
skærmen er afledte signaler fra `ProfileRowsService`, `AchievementsService`,
`UserProfileService`, `ReminderService` og `ThemeService`, så de opdaterer sig selv, når data ændrer sig et
andet sted i appen – fx når en ny vejning gemmes på Vægt.

## Log ud-knappen

Knappen er `app-ui-button` med `variant="outline"`; den røde tekst kommer fra
`.profile-page__logout`. `UiButton` har ikke en variant med omrids **og** rød tekst, og at
farve knappen her er billigere end en ny variant, der kun bruges ét sted.
