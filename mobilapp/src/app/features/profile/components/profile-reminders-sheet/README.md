# ProfileRemindersSheet

`app-profile-reminders-sheet` – arket "Dine **påmindelser**", der åbnes fra rækken
"Påmindelser" på profilen. Siden ejer `open` og lytter på `closed`.

## Indhold

Én række pr. påmindelse fra `REMINDER_DEFINITIONS`: Morgenmad, Frokost, Aftensmad (navnene
kommer fra `MEALS`), Vejning og Dagens madlog. Hver række har en `app-ui-switch` og en
opsummering ("Hver dag kl. 21:00", "Mandag kl. 07:30").

En påmindelse, der er slået til, viser sit tidspunkt i en `app-ui-text-input type="time"`.
Vejningen kan desuden begrænses til én ugedag med chips: "Hver dag", "Man" … "Søn".

Alt gemmes med det samme gennem `ReminderService` – der er ingen gem-knap, kun "Færdig". Et
tomt eller halvt indtastet tidspunkt ignoreres, så det sidst gyldige bliver stående.

## Standardtider

| Påmindelse    | Tid   | Til som standard |
| ------------- | ----- | ---------------- |
| Morgenmad     | 08:00 | nej              |
| Frokost       | 12:00 | nej              |
| Aftensmad     | 18:30 | nej              |
| Vejning       | 07:30 | nej (hver dag)   |
| Dagens madlog | 21:00 | ja               |

## Tilstande

Øverst vises højst én besked, i denne rækkefølge:

| Tilstand                                | Besked                                       | Kontakter  |
| --------------------------------------- | -------------------------------------------- | ---------- |
| Browser (`unsupported`)                 | Påmindelser virker kun i appen – valg gemmes | kan bruges |
| Hovedkontakten "Notifikationer" fra     | Forklaring + knap "Slå notifikationer til"   | låst       |
| Telefonen har afvist (`denied`)         | Giv lov i telefonens indstillinger           | låst       |
| Ikke spurgt endnu (`prompt`) og ≥ 1 til | Forklaring + knap "Tillad notifikationer"    | kan bruges |

Slår brugeren en påmindelse til, spørger `ReminderService` selv om lov, hvis det ikke er
besvaret. Fejl fra planlægningen vises med `app-ui-form-error`.
