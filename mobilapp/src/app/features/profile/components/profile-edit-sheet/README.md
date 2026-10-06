# ProfileEditSheet

`app-profile-edit-sheet` – bundarket "Rediger profil". Én komponent dækker alle designets
`editDefs`-varianter.

| Input | Type                       | Beskrivelse                            |
| ----- | -------------------------- | -------------------------------------- |
| `row` | `ProfileEditRowId \| null` | Rækken, der redigeres. `null` = lukket |

| Output   | Beskrivelse                                                             |
| -------- | ----------------------------------------------------------------------- |
| `closed` | Arket skal lukkes – efter luk-knap, scrim, Escape eller en gemt ændring |

Forælderen ejer, hvad der er åbent. Komponenten slår selv definitionen op i
`ProfileEditService`, så profilsiden kun skal kende rækkens id.

## De fire varianter

| Variant   | Felt                                                   | Gemmes          |
| --------- | ------------------------------------------------------ | --------------- |
| `options` | Liste af `app-ui-option-card`                          | Straks ved valg |
| `number`  | −/+ omkring et talfelt med enhed                       | Med "Gem"       |
| `date`    | Fødselsdato i `app-ui-text-input type="date"` (native) | Med "Gem"       |
| `text`    | E-mail i `app-ui-text-input`                           | Med "Gem"       |

De tre feltvarianter deler én formularkontrol (`form.value`, typet `number | string | null`) og
én `<form>`; skabelonen skifter kun selve feltet efter definitionens `kind`. Kontrollen fyldes med
rækkens nuværende værdi, hver gang arket åbner (eller definitionen skifter). Reglerne – `min`/`max`
fra definitionen, målvægtens `goalWeightError`, fødselsdatoens `isBirthdayValid` og e-mailens
`isValidEmail` – står ét sted, i `fieldError`, som både giver teksten og afgør `canSave`: "Gem"
er slået fra, indtil feltet er udfyldt og uden fejl – præcis som designets `editSaveDisabled`.

## Gem, fejl og fortryd

Alt gemmes i API'et gennem `ProfileEditService` (pessimistisk). Mens et kald kører, er
`saving` sand: "Gem" viser `UiButton`s spinner (`loading`), valgkortene er slået fra, og et
nyt tryk sender intet – så der aldrig går to kald af sted. Arket kan heller ikke lukkes
(`hideClose`), så svaret aldrig lander på en anden række. Lykkes det, lukker arket. Fejler
det, bliver arket åbent med en `UiFormError`:

| Fejl                     | Tekst                                                    |
| ------------------------ | -------------------------------------------------------- |
| Fødselsdato, 400 (alder) | `profile.edit.birthdayInvalid` ("… mellem 13 og 100 år") |
| E-mail, 409 / 400        | `core.auth.error.emailTaken` / `invalidEmail`            |
| Alt andet                | `profile.edit.saveFailed`                                |

Fejlen hører til den værdi, der blev sendt, så den forsvinder, så snart værdien ændres. En gemt
e-mail lukker ikke arket, men viser `profile.edit.emailSent` ("Vi har sendt et bekræftelseslink
til …") og en "Luk"-knap – adressen skifter først, når linket er trykket. Er adressen den
nuværende (uanset store/små bogstaver), sender API'et ingen mail, så arket lukker bare uden kald.
At lukke arket uden at gemme er fortryd: intet er ændret.

## Ugyldige værdier markeres (spec 2.x)

Bryder værdien feltets regel, er "Gem" slået fra, feltet får rød ramme (`invalid` på
`app-ui-text-input`, `profile-edit-sheet__number--invalid` på talfeltet), og
`app-ui-form-error` siger hvorfor – før noget sendes:

| Felt        | Regel                              | Tekst                                                  |
| ----------- | ---------------------------------- | ------------------------------------------------------ |
| Tal         | Uden for definitionens `min`–`max` | `profile.edit.numberRange` ("… mellem 120 og 230 cm.") |
| Målvægt     | `goalWeightError` (se nedenfor)    | Målvægtens egne tekster                                |
| Fødselsdato | `isBirthdayValid` (API'ets regel)  | `profile.edit.birthdayInvalid`                         |
| E-mail      | `isValidEmail`                     | `core.auth.error.invalidEmail`                         |

Et tomt felt slår kun "Gem" fra – ingen tekst, ingen rød ramme. API'ets afvisning af en
fødselsdato eller e-mail (tabellen ovenfor) markerer også feltet; en fejlet gemning gør ikke, for
værdien er i orden. Datovælgeren får fødselsdatoens grænser som native `min`/`max`.

## Målvægt og skift af mål

Målvægtsfeltet har en ekstra regel i `fieldError` fra `ProfileEditService.goalWeightError`, og
fejlen vises i `app-ui-form-error` under feltet (under/over vægten i dag, eller urealistisk BMI).

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
- Fødselsdatoen er den native datovælger, så den viser datoen i enhedens sprog og format, ikke
  appens (se [`UiTextInput`](../../../../shared/components/ui-text-input/README.md)).
