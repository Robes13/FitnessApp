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

## De fire varianter

| Variant    | Felt                                | Gemmes                |
| ---------- | ----------------------------------- | --------------------- |
| `options`  | Liste af `app-ui-option-card`       | Straks ved valg       |
| `number`   | −/+ omkring et talfelt med enhed    | Med "Gem"             |
| `text`     | E-mail i `app-ui-text-input`        | Med "Gem"             |
| `password` | To kodefelter, mindst 8 tegn og ens | Med "Gem" (asynkront) |

Alle felter er typede reactive forms. Grænser (`min`/`max`) kommer fra definitionen og sættes
som validators, når arket åbner, så "Gem" er slået fra, indtil tallet er gyldigt – præcis som
designets `editSaveDisabled`.

## Adgangskoden er asynkron

Adgangskoden findes ikke i `UserProfile`. "Gem" kalder derfor `AuthApi.resetPassword()` via
`ProfileEditService`: knappen viser spinner imens, og en fejl fra backenden vises i
`app-ui-form-error` i stedet for at lukke arket.

## Kendte afvigelser fra designet

- Designets valgte kort har en kraftigere orange bund (`rgba(249,115,22,.15)`) end
  `app-ui-option-card`s `accent`-stil. Kortet er ellers identisk, og den valgte tekst farves
  orange her i arket.
- Talfeltet er et almindeligt `<input type="number">`, fordi `app-ui-text-input` ikke har en
  display-størrelse på 38 px. Feltet har ingen egen ramme – kortet omkring det er rammen.
