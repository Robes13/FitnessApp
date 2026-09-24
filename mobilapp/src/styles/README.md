# Styling

Global styling og systemets design tokens. Alt, der gælder hele appen, bor
her — alt andet bor i den komponent, der ejer det.

## Filer

| Fil                | Indhold                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_tokens.scss`     | Design tokens som CSS-variabler. Systemets eneste kilde til farver, spacing, størrelser, typografi, radier, kanter, skygger, motion, blur og layout. Indeholder også lys-temaets overrides. |
| `_reset.scss`      | Global reset, `color-scheme`, `body`- og `app-root`-regler samt reduced-motion. Kun regler, der reelt gælder hele systemet.                                                                 |
| `_mixins.scss`     | Genbrugelige SCSS-hjælpere, importeres pr. komponent med `@use 'mixins';`.                                                                                                                  |
| `_animations.scss` | Globale `@keyframes` kopieret fra designet. Deles af figur-scener, ringe, badges, toasts og spinnere.                                                                                       |
| `../styles.scss`   | Indgangspunktet. Samler `tokens`, `reset` og `animations` — og intet andet.                                                                                                                 |

`src/styles.scss` samler kun de tre partials. **Der må ikke lægges
komponentstyling i den globale fil** — hver komponent har sin egen
`.scss`-fil.

Skrifttypen **Archivo Variable** er self-hosted via
`@fontsource-variable/archivo`. `@font-face`-reglerne (`wdth.css`, med
både vægt- og breddeakse) er lagt ind i `angular.json` → `styles` **før**
`src/styles.scss`, så fonten er defineret, når tokens refererer til den.

## Design tokens

Tokens er lagdelt:

1. **Palette** (`--palette-*`) — rå farveværdier fra designet. Bruges
   **ikke** direkte af komponenter.
2. **Semantisk** (`--color-*`, `--space-*`, `--size-*`, `--font-*`,
   `--radius-*`, `--border-width-*`, `--shadow-*`, `--duration-*`,
   `--easing-*`, `--blur-*`, `--layout-*`, `--z-index-*`) — det
   komponenter faktisk bruger. Farverne peger på paletten; gennemsigtige
   toner (`rgb(… / n%)`) står direkte i det semantiske lag.
3. **Komponent** — en komponent må definere egne lokale variabler
   (`--ring-size` osv.) til dynamisk geometri, men de skal være afledt af
   eller bundet fra TypeScript, aldrig hardcodede designværdier.

Temaskift rører kun det semantiske lag. Paletten er konstant.

### Grupper

| Præfiks                                                                                                                                                                            | Indhold                                                                                                                                                                                                                   | Eksempler                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `--palette-*`                                                                                                                                                                      | Rå farver                                                                                                                                                                                                                 | `--palette-secondary`, `--palette-slate-400`, `--palette-light-ink`           |
| `--color-background*`                                                                                                                                                              | App-baggrund (`#0f172a`), dyb baggrund bag app-roden (`#0b1120`) og scannerens altid mørke kameraflade                                                                                                                    | `--color-background`, `--color-background-deep`, `--color-background-scanner` |
| `--color-surface*`                                                                                                                                                                 | Glas-flader i fire styrker + hover; `--color-control(-hover)` er den runde knaps fyld; `--color-surface-translucent` er den mørke 55 %-bund på fotoskærme                                                                 | `--color-surface`, `--color-surface-4`, `--color-surface-hover`               |
| `--color-sheet`, `--color-scrim`, `--color-track`                                                                                                                                  | Bundark, dæmpet baggrund bag ark, skinne i sliders/progress                                                                                                                                                               |                                                                               |
| `--color-border*`                                                                                                                                                                  | Hairlines i fire styrker                                                                                                                                                                                                  | `--color-border-soft` (kort), `--color-border-strong` (inputs)                |
| `--color-text*`                                                                                                                                                                    | Tekst: primær, sekundær, dæmpet, blød, invers, på accent                                                                                                                                                                  | `--color-text-secondary`, `--color-text-on-accent`                            |
| `--color-primary`                                                                                                                                                                  | Blå cirkel bag avatarens forbogstav                                                                                                                                                                                       | `--color-primary`                                                             |
| `--color-accent*`                                                                                                                                                                  | **Orange = handling og fremhævning.** Hover/active/strong/deeper + soft/tint/border/ring-toner                                                                                                                            | `--color-accent`, `--color-accent-soft`, `--color-accent-border`              |
| `--color-selected*`                                                                                                                                                                | **Blå = valgt tilstand** (valgt kort, aktivt filter)                                                                                                                                                                      | `--color-selected`, `--color-selected-text`                                   |
| `--color-positive*`                                                                                                                                                                | Grøn = fremgang, mål nået                                                                                                                                                                                                 | `--color-positive`, `--color-positive-tint`                                   |
| `--color-negative*`                                                                                                                                                                | Rød = tilbagegang, fejl, destruktiv handling                                                                                                                                                                              | `--color-negative`, `--color-negative-border`                                 |
| `--color-warning`, `--color-info`, `--color-neutral*`                                                                                                                              | Gul, lyseblå info, grå toner til inaktive elementer                                                                                                                                                                       |                                                                               |
| `--color-focus-ring`, `--color-white`                                                                                                                                              | Fokusring (orange) og ren hvid                                                                                                                                                                                            |                                                                               |
| `--color-figure-*`                                                                                                                                                                 | Figurens (maskottens) farver — ens i begge temaer                                                                                                                                                                         | `--color-figure`, `--color-figure-shoe`, `--color-figure-sweat`               |
| `--color-ruler-*`                                                                                                                                                                  | Linealens små og store streger (slate-600/300) — ens i begge temaer                                                                                                                                                       | `--color-ruler-tick-minor`, `--color-ruler-tick-major`                        |
| `--space-*`                                                                                                                                                                        | 4px-skala fra `0` til `21` (5,25rem), halve trin som `--space-1-5`; `--space-1-25` (5px) er badge-padding                                                                                                                 | `--space-4` = 1rem                                                            |
| `--size-control-*`                                                                                                                                                                 | Knaphøjder 26–68px (`4xs` er den lille genlog-/fjern-knap). `--size-button-secondary` (46px) er fotoarkets sekundære knapper                                                                                              | `--size-control-xl` = 56px (pille-knap, rund knap)                            |
| `--size-icon-*`                                                                                                                                                                    | Ikonstørrelser 12–26px + `hero` 64px                                                                                                                                                                                      | `--size-icon-lg` = 20px                                                       |
| `--size-brand-logo-*`, `--size-tile-md`, `--size-badge-md`, `--size-calendar-cell`, `--size-recipe-hero`, `--size-scene-width`, `--size-field-number`, `--size-option-row-compact` | Enkeltstående mål fra designet, navngivet efter deres rolle                                                                                                                                                               | `--size-recipe-hero` = 150px                                                  |
| `--size-avatar-*`                                                                                                                                                                  | Avatarer 44 / 72 / 132 / 196px                                                                                                                                                                                            |                                                                               |
| `--size-dot-*`, `--size-thumb`, `--size-switch-*`, `--size-ruler-h*`, `--size-progress*`, `--size-option-tile-min-height`, `--size-portion-field`                                  | Faste widget-mål (intensitets-flisen 104px, portionsfeltet 96px)                                                                                                                                                          |                                                                               |
| `--font-family-*`, `--font-stretch-display`, `--font-weight-*`                                                                                                                     | Archivo Variable; display-overskrifter er kondenseret til 75 %                                                                                                                                                            |                                                                               |
| `--font-size-*`                                                                                                                                                                    | Brødtekst 9–20px (`3xs` … `4xl`)                                                                                                                                                                                          | `--font-size-base` = 14px, `--font-size-xl` = 16px                            |
| `--font-size-display-*`                                                                                                                                                            | Overskrifter og store tal 22–92px (`2xs` … `11xl`)                                                                                                                                                                        | `--font-size-display-lg` = 30px, `--font-size-display-11xl` = 92px            |
| `--line-height-*`, `--letter-spacing-*`                                                                                                                                            | Linjehøjder `.9`–`1.55`; spatiering fra `tighter` til `code` (kodefelt)                                                                                                                                                   |                                                                               |
| `--radius-*`                                                                                                                                                                       | `hairline` 1px, 4–28px, `pill` og `circle`                                                                                                                                                                                | `--radius-xl` = 16px (kort), `--radius-2xl` = 22px                            |
| `--border-width-*`                                                                                                                                                                 | 1 / 2 / 3 / 4px                                                                                                                                                                                                           | `1px solid` → `var(--border-width-thin) solid`                                |
| `--shadow-*`                                                                                                                                                                       | `sm/md/lg` + `sheet`, `nav`, `toast`, `accent-glow`, `accent-line-glow` (scan-linjen), `thumb`                                                                                                                            |                                                                               |
| `--duration-*`, `--easing-*`                                                                                                                                                       | 80–500ms + designets egne tempi: `scan-sweep` 900ms, `scene-swap` 550ms, `badge-pop` 600ms, `ring-close` 700ms, `confetti` 1000ms, `ring-halo` 1400ms, `toast-hold` 2900ms; `standard`, `spring`, `bounce`, `bounce-soft` |                                                                               |
| `--blur-*`                                                                                                                                                                         | `backdrop-filter` på glas-flader 6–14px                                                                                                                                                                                   | `--blur-lg` = 12px (inputs)                                                   |
| `--layout-*`                                                                                                                                                                       | Maksbredde, sidepadding, tab-bar-mål og -friplads, touch-target, `--layout-text-measure` (300px brødtekstspalte)                                                                                                          | `--layout-page-padding-x` = 24px                                              |
| `--gradient-*`                                                                                                                                                                     | Forløb, der går igen: `--gradient-photo-overlay` er login-/glemt-skærmenes forløb ned over fotoet (mørkt i begge temaer)                                                                                                  |                                                                               |
| `--safe-area-*`                                                                                                                                                                    | Notch og home indicator (`env()`)                                                                                                                                                                                         |                                                                               |
| `--keyboard-inset`                                                                                                                                                                 | Skærmtastaturets højde, mens det er åbent (sættes af `KeyboardService`). App-roden er `100dvh − --keyboard-inset`, og med `data-keyboard="open"` er `--safe-area-bottom` 0, fordi tastaturet dækker home-indikatoren.     |                                                                               |
| `--z-index-*`                                                                                                                                                                      | Lagorden: `base` 1 · `raised` 2 · `sticky`/`tab-bar` 10 · `toast` 15 · `sheet` 20 · `sheet-high` 25 · `overlay` 30 · `sheet-top` 40                                                                                       |                                                                               |

### Ældre navne

Disse navne fra det oprindelige stillads er bevaret og peger ind i
paletten, så gammel kode stadig virker. Ny kode bør bruge de semantiske
roller ovenfor (`--color-accent`, `--color-selected` osv.).

### Regel

En komponent må **aldrig** skrive en hex-farve, en px-værdi til spacing
eller en font-størrelse direkte. Mangler der en værdi, tilføjes en token i
`_tokens.scss` først. Eneste undtagelse er SVG-geometri (`viewBox`, `r`,
`stroke-width` i SVG-enheder) som attributter i templaten.

```scss
/* Forkert */
.card {
  padding: 20px;
  background: #fff;
  border: 1px solid #333;
}

/* Rigtigt */
.card {
  padding: var(--space-5);
  background: var(--color-surface);
  border: var(--border-width-thin) solid var(--color-border-soft);
}
```

### Sådan tilføjer du en token

1. Find værdien i designet (`Fitness App.dc.html`, inline `style="…"`).
2. Tjek først, om en eksisterende token har samme værdi — brug den.
3. Er værdien ny: læg den i den rigtige gruppe i `_tokens.scss` med et
   navn, der beskriver **rollen**, ikke værdien (`--color-accent-border`,
   ikke `--orange-45`).
4. Er det en farve, der skifter med temaet, lægges den mørke værdi i
   mixinen `theme-dark-colors` og overriden i `:root[data-theme='light']`
   nederst i filen.
5. Opdatér tabellen ovenfor, hvis du tilføjer en ny gruppe.

## Tema

**Mørkt tema er standard.** Designet er dark-first, og alle værdier i
`:root` er dark-værdierne.

**Lyst tema** er opt-in via `data-theme="light"` på `<html>`. Overrides
ligger i `:root[data-theme='light']` i `_tokens.scss` og svarer til
designets `.theme-light`. Kun baggrund, flader, kanter, tekst, den runde
knaps fyld og `sm/md/lg`-skyggerne skifter — accent, valgt, positiv,
negativ og figurens farver er ens i begge temaer.

**Operativsystemets `prefers-color-scheme` følges bevidst ikke.**
Brugeren slår "Lys tilstand" til og fra under Profil, og valget gemmes.
`ThemeService` (i `core/services`) sætter og fjerner `data-theme` på
`document.documentElement` og genskaber valget ved opstart. Derfor er der
ingen `@media (prefers-color-scheme)` i tokens-filen.

**Et under-træ kan blive mørkt i lyst tema** med `data-theme="dark"` på sit
element. De mørke værdier for alt, det lyse tema ændrer, ligger i mixinen
`theme-dark-colors` i `_tokens.scss`, som både `:root` og
`:root[data-theme='light'] [data-theme='dark']` bruger. Fotoskærmene (login
og glemt adgangskode) gør det, fordi fotoet er mørkt i begge temaer – ellers
ville mørk tekst ligge på det mørke foto. De holder også systembarernes
ikoner lyse (`ThemeService.holdDarkSystemBars`).

`_reset.scss` sætter `color-scheme: dark` på `html` og `light` under
`:root[data-theme='light']`, så native formularkontroller og scrollbars
følger temaet. `index.html` deklarerer `<meta name="color-scheme"
content="dark light">` (mørk først) og `theme-color` = `--color-background`.

## Typografi

Al tekst er **Archivo Variable**. Display-overskrifter (`.disp` i designet)
er kondenserede: `font-stretch: 75%`, vægt 800, uppercase, spatiering
−.01em, linjehøjde 1,03. Designet bruger .95, men så rører ringen på Å
linjen over i en overskrift på to linjer ("HVAD ER DIN / MÅLVÆGT?"). Brug
mixinen `display-heading` i stedet for at gentage det. Ét ord i en
overskrift er typisk orange (`--color-accent`).

`body` har `font-size: var(--font-size-xl)` (16px), fordi designet ikke
sætter en body-størrelse — tekst uden eksplicit størrelse er 16px.
Komponenter sætter deres egen størrelse.

## Mixins

`src/styles` er tilføjet som `includePaths` i `angular.json`, så en
komponent importerer mixins uden relative stier:

```scss
@use 'mixins';

.food-page {
  @include mixins.page-screen;

  &__scroll {
    @include mixins.scroll-area;
    padding-inline: var(--layout-page-padding-x);
  }
}
```

| Mixin               | Formål                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------- |
| `visually-hidden`   | Skjul visuelt, bevar for skærmlæsere                                                   |
| `touch-target`      | Minimum berøringsflade på telefon (44px)                                               |
| `text-truncate`     | Én linje med ellipsis                                                                  |
| `page-container`    | Centreret sidebredde med sidepadding                                                   |
| `display-heading`   | Designets `.disp`: kondenseret Archivo, 800, uppercase                                 |
| `caption-uppercase` | 11px uppercase, bred spatiering, sekundær tekstfarve                                   |
| `surface-card`      | Standardkort: glas-fyld, blød hairline, 16px radius                                    |
| `hide-scrollbar`    | Skjul scrollbar uden at fjerne scroll                                                  |
| `tabular-nums`      | Tal med fast bredde, så skiftende tal ikke hopper                                      |
| `page-screen`       | Route-komponentens rod: flex-kolonne, fuld højde, notch-padding                        |
| `scroll-area`       | Scroll-container i en side: `flex: 1; min-height: 0; overflow-y: auto; display: block` |
| `hover`             | Hover-stil kun med en rigtig pegeenhed, så den ikke klæber efter et tryk på touch      |
| `short-screen`      | Lave telefoner (viewport ≤ 700px høj, fx 360 × 640 og iPhone SE)                       |
| `tablet`            | Begge sider mindst 720px – bruges til at skalere telefonlayoutet op                    |

`scroll-area` indkapsler designerens hårdt lærte regel: en
scroll-container **skal** have `min-height: 0` og `display: block`, ellers
klemmer flex-forælderen børnene flade.

**Hover:** alle `:hover`-regler pakkes i `@include mixins.hover { … }`, som kun gælder på en
enhed med en rigtig pegeenhed (`@media (hover: hover)`). På en touchskærm bliver `:hover`
ellers hængende på det sidst trykkede element – på iOS indtil næste tryk.

## Animationer

`_animations.scss` indeholder alle designets `@keyframes`, kopieret
uændret. Komponenter refererer dem ved navn i `animation:` og leverer selv
varighed, easing og iterationer (gerne via `--duration-*` /
`--easing-*`, men figur-scenerne har egne tempi, der styres af data).

| Keyframes                                       | Bruges til                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| `drip`, `steam`                                 | Sved og damp i vægt-scenen                                              |
| `fan`, `curl`, `trot`, `pentap`, `sign`         | Figurens småbevægelser (vifte, biceps-curl, hund, pen, signatur)        |
| `strideA/B`, `swingA/B`, `walkbob`, `ground`    | Gå-scenen på aktivitetstrinnet                                          |
| `ring`                                          | Klokken på notifikationstrinnet                                         |
| `flicker`, `glow`                               | Lys på kagen                                                            |
| `numtickA/B`                                    | Talhop pr. 1.000 skridt — skift mellem A og B for at genstarte          |
| `conf`                                          | Konfetti. Læser `--cx` og `--cr` pr. partikel (bindes fra TS med enhed) |
| `sweep`, `ecgmove`, `tvglow`                    | Stopur, EKG-linje og tv-skær i doven-scenen                             |
| `dcspin`                                        | Spinner i knapper                                                       |
| `ringClose`, `ringHalo`, `badgePop`, `badgeOut` | Dagsring lukkes, fejrings-toast ind/ud                                  |

px-værdierne i keyframes er animationsgeometri fra designet — ikke
layoutværdier — og skal ikke tokeniseres.

`_reset.scss` slår alle animationer og transitions fra ved
`prefers-reduced-motion: reduce`. Det er systemets ene sanktionerede brug
af `!important`.

## Navngivning (BEM)

```
.block { }
.block__element { }
.block--modifier { }
```

Blocknavnet matcher komponenten (`ui-button` → `.ui-button`). Skriv BEM med
SCSS-nesting og `&`, så klassenavnene kan søges i koden:

```scss
.ui-button {
  &__content {
  }
  &--primary {
  }
}
```

## Layout og safe areas

Native notch og home indicator eksponeres som
`--safe-area-top/right/bottom/left`. Brug dem i stedet for `env()` direkte,
så værdierne kan overrides ét sted.

Sidernes lodrette padding er allerede pakket ind i
`--layout-page-padding-top` (`safe-area-top + 20px`) og
`--layout-tab-bar-offset` (`safe-area-bottom + 20px`). En side med tab bar
slutter med en spacer på `--layout-tab-bar-clearance`
(`safe-area-bottom + 84px` = barens offset plus dens højde), så indholdet kan
scrolles fri af baren — også på telefoner med home indicator.

**Lave skærme og tablets.** Alle mål er i `rem`, så skalering sker ét sted i
`_tokens.scss`: på `short-screen` går de største display-størrelser (`--font-size-display-3xl`,
`-10xl`, `-11xl`) et trin ned, så signup-trinnenes kontrol (lineal, ugedage, kalender) står over
folden. Trin, hvor det stadig ikke er nok, skjuler en gentagende eller dekorativ del dér
(fødselsdagens alders-visning, intensitetens tal og figur, målvægtens "Nu: …"-linje). På `tablet` får `html` 125 % (150 %
på høje tablets i portræt), så telefonlayoutet fylder skærmen i stedet for at stå som en smal
kolonne. Telefoner er låst til portræt (Info.plist og AndroidManifest); tablets drejer frit.

Display-overskrifter (`display-heading`) bryder et langt ord i stedet for at løbe ud over
kanten, når systemets skriftstørrelse er stor. Lange ord i overskrifter kan få en blød
bindestreg (`adgangs&shy;kode`), så bruddet sker ved en stavelse.

`body` har baggrunden `--color-background-deep`, og `app-root` fylder
viewporten (`100dvh`) og begrænses til `--layout-max-width` af
shell-komponenten. På en telefon er de to baggrunde derfor kun synlige som
én flade.
