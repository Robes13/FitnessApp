# Profil – komponenter

Feature-specifikke komponenter. De må kun bruges af profilskærmen; alt, en anden feature
også skal kunne bruge, hører til i `shared/components/`.

| Mappe                                                                     | Komponent                          | Rolle                                               |
| ------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| [`profile-avatar/`](profile-avatar/README.md)                             | `app-profile-avatar`               | Avataren i 72 / 132 / 196 px + beskæringsformlerne  |
| [`achievements/`](achievements/README.md)                                 | `app-achievements`                 | Gitteret med de 12 præstationer                     |
| [`profile-edit-sheet/`](profile-edit-sheet/README.md)                     | `app-profile-edit-sheet`           | "Rediger profil" – liste, tal, tekst og adgangskode |
| [`profile-photo-sheet/`](profile-photo-sheet/README.md)                   | `app-profile-photo-sheet`          | "Profilbillede" – filvalg, træk og zoom             |
| [`profile-reminders-sheet/`](profile-reminders-sheet/README.md)           | `app-profile-reminders-sheet`      | "Dine påmindelser" – typer, tider og vejedag        |
| [`profile-logout-sheet/`](profile-logout-sheet/README.md)                 | `app-profile-logout-sheet`         | "Log ud?" – bekræftelsen                            |
| [`profile-delete-account-sheet/`](profile-delete-account-sheet/README.md) | `app-profile-delete-account-sheet` | "Slet konto?" – bekræftelsen (GDPR)                 |

Alle arkene er bygget på `app-ui-sheet` og ejer ikke deres egen åben-tilstand: siden sender
`open` (eller `row`) ind og lytter på `closed`. Det holder navigation og "hvad er åbent" ét
sted.

`app-profile-avatar` er den eneste af dem, der ikke er et ark – den findes, fordi den samme
beskæring skal tegnes tre steder i tre størrelser.
