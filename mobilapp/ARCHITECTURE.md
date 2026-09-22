# Arkitektur og udviklingsregler

Dette dokument er **bindende** for al kode i projektet. Al ny kode, alle
refaktoreringer og alle code reviews skal holdes op mod reglerne herunder.

> Læs dette dokument **før** du skriver kode. Se [CLAUDE.md](CLAUDE.md).

---

## 1. Hvad projektet er

En **mobil app** bygget med Angular og pakket ind i native iOS- og
Android-skaller via Capacitor. Der er ingen desktop-visning og intet
responsivt web-layout ud over telefonformater — layoutet er phone-first og
begrænses af `--layout-max-width`.

---

## 2. Generelle regler

- Projektet følger Angulars anbefalede struktur og best practices.
- Der skal ligge `README.md`-filer, hvor det giver mening. README-filerne er
  systemets kodedokumentation og forklarer funktionalitet, arkitektur og
  særlige beslutninger.
- **Eksisterende funktionalitet og komponenter genbruges** frem for at blive
  implementeret igen. Søg i `shared/` og `core/` før du skriver nyt.
- Genbrugelige UI-elementer implementeres som selvstændige komponenter.
- Undgå unødvendig kompleksitet. Vælg den simpleste løsning, der stadig er
  skalerbar og vedligeholdelsesvenlig.
- TypeScript bruges med strict typing. `any` må som udgangspunkt ikke
  anvendes.

---

## 3. Mappestruktur og lagdeling

Projektet er lige nu et tomt stillads: kun app-roden og de globale styles
findes. Mapperne herunder oprettes, efterhånden som der bygges — og **kun**
efter denne struktur:

```
src/
├── styles/                 Globale design tokens, reset og mixins
├── app/
│   ├── core/               App-dækkende fundament (ingen afhængigheder opad)
│   │   ├── constants/      Konstanter, ingen magic strings andre steder
│   │   ├── models/         App-dækkende typer og interfaces
│   │   └── services/       App-dækkende services (singletons)
│   ├── shared/             Genbrugelige, feature-agnostiske byggeklodser
│   │   └── components/     UI-komponenter uden forretningslogik
│   └── features/           Én mappe pr. feature/domæne
│       └── <feature>/
│           ├── <feature>.routes.ts   Lazy loadet route-konfiguration
│           ├── pages/                Route-komponenter
│           ├── components/           Feature-specifikke komponenter
│           ├── services/             Feature-specifikke services
│           └── models/               Feature-specifikke typer
```

Hver ny mappe under `core/`, `shared/` og `features/` skal have en
`README.md`, der forklarer, hvad den indeholder.

**Afhængighedsretning — må kun gå én vej:**

```
features  →  shared  →  core
```

- `core` må ikke importere fra `shared` eller `features`.
- `shared` må ikke importere fra `features`.
- En feature må ikke importere fra en anden feature. Skal to features dele
  noget, flyttes det til `shared` (UI) eller `core` (logik/typer).
- **Cirkulære dependencies må ikke introduceres.**

Funktionalitet organiseres efter feature/domæne — ikke udelukkende efter
filtype.

---

## 4. Angular-komponenter

- Én komponent = ét klart ansvar.
- Store komponenter splittes op, når de håndterer flere uafhængige ansvar.
- Genbrugelige komponenter (`shared/`) må **ikke** indeholde feature-specifik
  forretningslogik. De modtager data via inputs og rapporterer via outputs.
- Inputs og outputs skal være tydeligt typet. Brug signal-baserede
  `input()` / `input.required()` / `output()`.
- Komponenter bruger `ChangeDetectionStrategy.OnPush`.
- **Logik holdes ude af templates.** Beregninger lægges i `computed()` eller
  en metode på klassen — ikke som udtryk i templaten.
- Templates skal være simple og lette at læse. Brug `@if` / `@for` /
  `@switch`.
- Angulars indbyggede funktionalitet foretrækkes frem for specialbyggede
  løsninger, når det giver mening.

### Navngivning

| Ting | Konvention | Eksempel |
| --- | --- | --- |
| Filnavn | kebab-case, uden `.component`-suffiks | `ui-button.ts` |
| Klasse | PascalCase | `UiButton` |
| Selector | `app-` + kebab-case | `app-ui-button` |
| Route-fil | `<feature>.routes.ts` | `home.routes.ts` |
| Konstant | SCREAMING_SNAKE_CASE | `PRIMARY_NAVIGATION_ITEMS` |

---

## 5. Styling

- Styling er **komponentbaseret**. Hver komponent har sin egen `.scss`-fil.
- Globale styles (`src/styles.scss`) må kun indeholde det, der reelt gælder
  hele systemet: design tokens og reset.
- **CSS-klasser følger BEM**: `.block`, `.block__element`,
  `.block--modifier`. Blocknavnet matcher komponenten.
- Farver, spacing, typografi, border-radius, skygger og motion defineres
  centralt i [`src/styles/_tokens.scss`](src/styles/_tokens.scss) som
  CSS-variabler. **Hardcodede hex-værdier og px-værdier i komponenter er
  ikke tilladt** — tilføj en token i stedet.
- `!important` undgås.
- Styling må ikke basere sig på skrøbelige selectors eller afhænge unødigt af
  DOM-strukturen. Undgå `::ng-deep`, element-selectors og dybe descendant-
  selectors.
- **Bootstrap eller andre UI-frameworks må ikke bruges.** Alle UI-komponenter
  udvikles specifikt til systemet.

### Farvepalette

| Token | Værdi | Brug |
| --- | --- | --- |
| `--color-primary` | `#2563EB` | Primær handling, aktiv tilstand |
| `--color-secondary` | `#F97316` | Sekundær handling, accent |
| `--palette-background-dark` | `#0F172A` | Baggrund i dark mode |
| `--palette-background-light` | `#F8FAFC` | Baggrund i light mode |
| `--color-text` | `#111827` | Primær tekst |
| `--color-text-muted` | `#64748B` | Sekundær tekst |

---

## 6. Routing

- **Alle features lazy loades** via `loadChildren`, så den initielle bundle
  holdes så lille som muligt. En feature må først hentes, når brugeren
  navigerer ind i den.
- Undtagelse: indhold som brugeren ser umiddelbart efter (paginering,
  uendelig scroll) må forhentes bevidst.
- Route guards bruges **kun** til routing-relateret adgangskontrol og
  navigation — ikke til at hente data eller udføre forretningslogik.
- Routes har konsistente, beskrivende navne og samles som konstanter i
  `src/app/core/constants/app-route.ts` (oprettes sammen med den første
  feature). Route-stier må ikke skrives som strengliteraler rundt i koden.
- Routing-strukturen afspejler applikationens funktionelle struktur.

---

## 7. TypeScript

- Alle funktioner, interfaces, API-modeller og offentlige properties har
  tydelige typer.
- `any` må kun bruges i helt særlige tilfælde og skal begrundes i en
  kommentar direkte over brugen.
- Brug `interface` eller `type` til strukturerede data.
- **Ingen magic strings eller magic numbers.** Brug konstanter, `as const`
  objekter eller enums.
- Variabel-, metode-, klasse- og filnavne beskriver tydeligt deres formål.
- Død kode og ubrugte imports fjernes. `noUnusedLocals` og
  `noUnusedParameters` er slået til, så det fejler i build.

---

## 8. API og data

- Alle API-svar har et defineret interface eller en type.
- Utypede objekter må ikke sendes på tværs af applikationens lag.
- API-kald samles i services — aldrig direkte fra en komponent.
- Services har ét klart og afgrænset ansvar.
- API-fejl håndteres eksplicit. Ingen tavse `catch`.
- UI'et håndterer **loading-, empty- og error-states**.
- Backend-modeller og UI-modeller holdes adskilt, når deres ansvar eller
  datastruktur er forskelligt. Mapning sker i servicelaget.
- Forretningslogik holdes adskilt fra præsentationslogik.
- Undgå duplikeret kode. Optræder samme logik flere steder, skal det
  vurderes, om den bør abstraheres.

---

## 9. State og reaktivitet

- Lokal state holdes så tæt på den komponent eller feature, der bruger den,
  som muligt.
- Global state bruges kun til data, der reelt deles på tværs af
  applikationen.
- Subscriptions håndteres, så der ikke opstår memory leaks — brug
  `takeUntilDestroyed()` eller `toSignal()`.
- Undgå manuelle subscriptions, når signals eller `async`-pipe kan klare det
  simplere.
- **Derived state beregnes med `computed()`** ud fra eksisterende state frem
  for at blive gemt separat.

---

## 10. Forms

- Formularer har tydelig validering.
- Valideringsfejl vises ensartet i hele systemet — via en fælles
  fejlkomponent i `shared/`.
- Gentagen formularlogik abstraheres, når det giver mening.
- Formularmodeller og inputdata er typede. Brug typed reactive forms
  (`FormGroup<T>`), ikke template-driven forms.

---

## 11. Fejlhåndtering

- Fejl må ikke ignoreres eller skjules uden en bevidst, dokumenteret grund.
- Brugeren skal have forståelig feedback, hvis en handling fejler.
- Tekniske fejlbeskeder fra backend vises ikke direkte til slutbrugeren,
  medmindre de er beregnet til det.
- Logging skal indeholde nok information til fejlsøgning uden at eksponere
  følsomme data (tokens, personoplysninger, adgangskoder).

---

## 12. Git og udviklingsproces

- Commit-beskeder følger [Conventional Commits](https://www.conventionalcommits.org/):

  ```
  feat: add user search
  fix: handle empty API response
  refactor: extract shared table component
  docs: describe routing rules
  chore: bump capacitor to 8.5
  ```

- Pull requests skal være fokuserede og så små, at de kan reviewes på under
  30 minutter.

---

## 13. Checkliste før commit

- [ ] Har jeg genbrugt eksisterende komponenter/services i stedet for at
      skrive nyt?
- [ ] Er nye genbrugelige UI-elementer lagt i `shared/` uden
      forretningslogik?
- [ ] Er alle nye typer eksplicitte? Ingen `any`?
- [ ] Bruger min styling design tokens og BEM? Ingen hardcodede farver?
- [ ] Er nye features lazy loadet?
- [ ] Går alle imports den rigtige vej (`features → shared → core`)?
- [ ] Håndterer UI'et loading, tom tilstand og fejl?
- [ ] Er ubrugt kode og imports fjernet?
- [ ] Bygger `npm run build` uden fejl eller advarsler?
- [ ] Følger commit-beskeden Conventional Commits?
