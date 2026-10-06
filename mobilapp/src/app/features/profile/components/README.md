# Profil – komponenter

Feature-specifikke komponenter. De må kun bruges af profilskærmen; alt, en anden feature
også skal kunne bruge, hører til i `shared/components/`.

| Mappe                                                           | Komponent                     | Rolle                                        |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------------------- |
| [`achievements/`](achievements/README.md)                       | `app-achievements`            | Gitteret med de 12 præstationer              |
| [`profile-edit-sheet/`](profile-edit-sheet/README.md)           | `app-profile-edit-sheet`      | "Rediger profil" – liste, tal og tekst       |
| [`profile-photo-sheet/`](profile-photo-sheet/README.md)         | `app-profile-photo-sheet`     | "Profilbillede" – vælg, beskær og upload     |
| [`profile-reminders-sheet/`](profile-reminders-sheet/README.md) | `app-profile-reminders-sheet` | "Dine påmindelser" – typer, tider og vejedag |
| [`profile-step-sync/`](profile-step-sync/README.md)             | `app-profile-step-sync`       | Skridt fra Apple Sundhed / Health Connect    |

Alle arkene er bygget på `app-ui-sheet` og ejer ikke deres egen åben-tilstand: siden sender
`open` (eller `row`) ind og lytter på `closed`. Det holder navigation og "hvad er åbent" ét
sted.

"Log ud?" og "Slet konto?" (også ved træk samtykke tilbage) har ingen egne komponenter: siden bruger
`app-ui-confirm-sheet` fra `shared/` med sine egne oversættelsesnøgler.

`achievements` og `profile-step-sync` er ikke ark. `profile-step-sync` er en række i
"Privatliv" og ejer selv sit slå fra-ark, fordi arket kun hører til den række. Avataren ligger i
`shared/components/profile-avatar/`, fordi Hjem også viser den.
