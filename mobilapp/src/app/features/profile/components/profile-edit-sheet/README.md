# ProfileEditSheet

`app-profile-edit-sheet` – bundarket "Rediger profil". Én komponent dækker alle designets
`editDefs`-varianter.

| Input | Type                       | Beskrivelse                            |
| ----- | -------------------------- | -------------------------------------- |
| `row` | `ProfileEditRowId \| null` | Rækken, der redigeres. `null` = lukket |

| Output   | Beskrivelse                                                          |
| -------- | -------------------------------------------------------------------- |
| `closed` | Arket skal lukkes – efter luk-knap, scrim, Escape eller et gemt valg |

Forælderen ejer, hvad der er åbent. Komponenten slår selv definitionen op i
`ProfileEditService`, så profilsiden kun skal kende rækkens id.

## De tre varianter

| Variant   | Felt                             | Gemmes          |
| --------- | -------------------------------- | --------------- |
| `options` | Liste af `app-ui-option-card`    | Straks ved valg |
| `number`  | −/+ omkring et talfelt med enhed | Med "Gem"       |
| `text`    | E-mail i `app-ui-text-input`     | Med "Gem"       |

Alle felter er typede reactive forms. Grænser (`min`/`max`) kommer fra definitionen og sættes
som validators, når arket åbner, så "Gem" er slået fra, indtil tallet er gyldigt – præcis som
designets `editSaveDisabled`.

## Målvægt og skift af mål

Målvægtsfeltet har en ekstra validator fra `ProfileEditService.goalWeightError`, og fejlen
vises i `app-ui-form-error` under feltet (under/over vægten i dag, eller urealistisk BMI).

Returnerer `applyOption('goal', …)` `needs-goal-weight`, lukker arket ikke. Det gemmer målet i
`pendingGoal` (et `linkedSignal`, der nulstilles, når en ny række åbnes) og viser
målvægtsfeltet for det nye mål. "Gem" skriver mål og målvægt samlet; lukkes arket, er
intet ændret.

## Kendte afvigelser fra designet

- Designets valgte kort har en kraftigere orange bund (`rgba(249,115,22,.15)`) end
  `app-ui-option-card`s `accent`-stil. Kortet er ellers identisk, og den valgte tekst farves
  orange her i arket.
- Talfeltet er et almindeligt `<input type="number">`, fordi `app-ui-text-input` ikke har en
  display-størrelse på 38 px. Feltet har ingen egen ramme – kortet omkring det er rammen.
