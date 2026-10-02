# UiTextInput

Designets `.glass-input`: glas-fyld, hairline, 14 px radius, blur og orange fokusring.
Implementerer `ControlValueAccessor`, så feltet bruges med typed reactive forms.

```html
<app-ui-text-input
  formControlName="password"
  type="password"
  placeholder="Adgangskode"
  ariaLabel="Adgangskode"
  autocomplete="current-password"
  [invalid]="showError()"
/>
<app-ui-form-error [message]="error()" />
```

| Input          | Standard     | Betydning                                                                                                                                                                       |
| -------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`         | `'text'`     | `text` · `password` · `email` · `number` · `time` (værdien er `'HH:MM'`) · `date` (native datovælger, værdien er `'YYYY-MM-DD'`)                                                |
| `placeholder`  | `''`         |                                                                                                                                                                                 |
| `inputMode`    | `null`       | `numeric`, `decimal`, `email` … til det native tastatur                                                                                                                         |
| `maxLength`    | `null`       | Fx `4` til bekræftelseskoden                                                                                                                                                    |
| `min` / `max`  | `null`       | Native `min`/`max`, fx `'YYYY-MM-DD'`-grænser til datovælgeren (profilens fødselsdato)                                                                                          |
| `autocomplete` | `null`       | Native `autocomplete`-værdi. `username`, `email`, adgangskoder og koder (samt `type="email"`/`"password"`) får intet stort begyndelsesbogstav, autokorrektur eller stavekontrol |
| `ariaLabel`    | `null`       | Tilgængeligt navn, når der ikke er en synlig label                                                                                                                              |
| `invalid`      | `false`      | Farvet kant + `aria-invalid`                                                                                                                                                    |
| `invalidTone`  | `'negative'` | `negative` rød kant · `accent` orange kant (uens adgangskoder)                                                                                                                  |
| `translucent`  | `false`      | Mørk 55 % bund til felter oven på fotos (glemt adgangskode)                                                                                                                     |
| `centered`     | `false`      | Kodefeltet: centreret, display-skrift 26 px, bred spatiering                                                                                                                    |
| `revealable`   | `true`       | Øje-knap på `type="password"` (`aria-label="Vis adgangskode"`, `aria-pressed`)                                                                                                  |
| `size`         | `'lg'`       | `lg` 52 px · `md` 48 px                                                                                                                                                         |

| Output    | Betydning                                |
| --------- | ---------------------------------------- |
| `blurred` | Feltet mistede fokus (efter `onTouched`) |

## Beslutninger

- **Værdi-typen** følger Angulars egne accessors: tekstfelter giver `string`, `type="number"`
  giver `number` eller `null`, når feltet er tomt (`TextInputValue`).
- **Øjet skifter kun tilstand**, ikke tekst: designet har én label, "Vis adgangskode", og
  knappen fortæller med `aria-pressed`, om koden er vist.
- `invalid` bruger `--color-negative` (rød = fejl). Designets ene eksempel på en fejlkant er
  orange, men spec'en bruger rød på opsummeringens e-mail, og rød er systemets fejlfarve.
- Den mørke `translucent`-bund er tokenet `--color-surface-translucent` (designets
  `rgba(15,23,42,.55)`, ens i begge temaer, fordi fotoet bag feltet altid er mørkt).
- Host-styling står som `:host(.ui-text-input--invalid) .ui-text-input__field { … }`; under
  emuleret encapsulation rammer en `.ui-text-input--invalid`-regel aldrig værten selv.
- Tal-felter skjuler browserens pile (`appearance: textfield`), fordi designet bruger −/+ knapper.
- `time` og `date` er `display: block` uden native `appearance`: ellers giver iOS feltet en
  indbygget bredde, og det løber ud over arket (fødselsdatoen på Profil blev skåret af i højre side).
- `date` er den native datovælger, så **datoformatet og vælgerens sprog følger enhedens sprog og
  region**, ikke appens sprog (`lang` på `<html>` styrer ikke native kontroller). På en dansk telefon
  står der `03.10.1978`; på en telefon på amerikansk engelsk (som standard-emulatoren) står der
  `10/03/1978` og "CANCEL/SET", også når appen er på dansk. Det er enhedens eget format, så brugeren
  læser det, som telefonen ellers viser datoer. Skal formatet følge appens sprog, kræver det en
  egen datovælger i stedet for den native.
