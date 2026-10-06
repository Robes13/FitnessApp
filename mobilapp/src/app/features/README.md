# Features

Én mappe pr. feature/domæne. En feature må importere fra `shared/` og `core/` – aldrig fra en
anden feature. Skal to features dele noget, flyttes det til `shared` (UI) eller `core`
(logik/typer).

## Opbygning af en feature

```
features/<feature>/
├── README.md               Hvad featuren gør og særlige beslutninger
├── <feature>.routes.ts     Lazy loadet route-konfiguration (eksporterer én navngiven konstant)
├── pages/                  Route-komponenter, én mappe pr. side: pages/<navn>-page/<navn>-page.ts
├── components/             Feature-specifikke komponenter
├── services/               Feature-specifikke services
└── models/                 Feature-specifikke typer
```

Route-filen er featurens eneste indgang. `src/app/app.routes.ts` (og `shell.routes.ts`)
lazy loader den med `loadChildren` og forventer præcis disse konstanter:

| Feature       | Route-fil                   | Konstant                 | Sti (`APP_ROUTE`)          |
| ------------- | --------------------------- | ------------------------ | -------------------------- |
| `auth`        | `auth.routes.ts`            | `AUTH_ROUTES`            | `LOGIN` (`/login`)         |
| `auth`        | `forgot-password.routes.ts` | `FORGOT_PASSWORD_ROUTES` | `FORGOT_PASSWORD`          |
| `signup`      | `signup.routes.ts`          | `SIGNUP_ROUTES`          | `SIGNUP` (`/opret`)        |
| `shell`       | `shell.routes.ts`           | `SHELL_ROUTES`           | `ROOT` – rammen om tabs    |
| `home`        | `home.routes.ts`            | `HOME_ROUTES`            | `HOME` (`/hjem`)           |
| `food`        | `food.routes.ts`            | `FOOD_ROUTES`            | `FOOD` (`/mad`)            |
| `weight`      | `weight.routes.ts`          | `WEIGHT_ROUTES`          | `WEIGHT` (`/vaegt`)        |
| `collections` | `collections.routes.ts`     | `COLLECTIONS_ROUTES`     | `COLLECTIONS` (`/samling`) |
|               |                             | `RECIPE_ROUTES`          | `/samling/:recipeId`       |
| `history`     | `history.routes.ts`         | `HISTORY_ROUTES`         | `HISTORY` (`/historik`)    |
| `profile`     | `profile.routes.ts`         | `PROFILE_ROUTES`         | `PROFILE` (`/profil`)      |

## Routing-struktur

```
/login, /glemt-adgangskode, /opret     guestGuard  – kun for udloggede
/profil                                authGuard   – uden tab bar (åbnes fra avataren på Hjem)
/samling/:recipeId                     authGuard   – opskriften, uden tab bar
/                                      authGuard   – ShellLayout med tab bar
   ├── ''  → /hjem
   ├── /hjem, /mad, /vaegt, /samling, /historik   (lazy loadede tab-features)
**                                     → /hjem     (ukendt sti)
```

Stier skrives aldrig som strenge – brug `APP_ROUTE` (segmenter) og `APP_PATH` (absolutte
stier) fra `core/constants/app-route.ts`. Guards ligger i `core/guards/`.

## Shell

[`shell/`](shell/README.md) er ikke en skærm men rammen om tab-skærmene: en `<router-outlet>`
plus `<app-ui-tab-bar>`. En fuldskærm uden tab bar (Profil, opskriften under Samling) lægges uden
for shell'en i `app.routes.ts`, så den ikke arver baren.

## Konventioner for sider

- En side (route-komponent) er `display: flex; flex-direction: column; height: 100%` med
  padding-top `--layout-page-padding-top` – brug mixinen `page-screen`.
- Indholdet ligger i en scroll-container (`mixins.scroll-area`, `padding-inline:
var(--layout-page-padding-x)`). Sider med tab bar slutter med en spacer på
  `--layout-tab-bar-clearance`, så indholdet kan scrolles fri af baren.
- Route- og query-parametre bindes til `input()` på siden (`withComponentInputBinding()` er
  slået til i `app.config.ts`).
- Styling af selve host-elementet (`host: { class: 'food-page' }`) skrives som `:host { … }`
  i komponentens `.scss`. En almindelig `.food-page { … }`-regel bliver under emuleret
  encapsulation scoped til indholdet og rammer aldrig host-elementet. BEM-klasserne
  `.food-page__…` bruges som normalt på elementerne i templaten.
- Al brugerrettet tekst er dansk og kopieret ordret fra designet.

## Pladsholdere

Under opbygningen indeholder en feature-mappe kun sin route-fil og en minimal side i
`pages/<navn>-page/`, der viser sidens navn i en `<h1>`. De er bevidst uden README og egne
`.html`/`.scss`-filer og erstattes af den rigtige implementering – route-konstantens navn og
filens placering skal bevares.
