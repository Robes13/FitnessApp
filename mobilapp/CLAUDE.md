# CLAUDE.md

## Læs dette først

**Inden du skriver eller ændrer kode i dette projekt, skal du læse
[`ARCHITECTURE.md`](ARCHITECTURE.md).**

`ARCHITECTURE.md` indeholder projektets bindende arkitektur- og kodregler.
Reglerne er ikke vejledende — de gælder for al kode i repoet. Al output, du
producerer, skal overholde dem.

Arbejdsgang for enhver opgave:

1. Læs `ARCHITECTURE.md`.
2. Læs `README.md` i de mapper, opgaven rører — f.eks.
   [`src/styles/README.md`](src/styles/README.md).
3. Undersøg, om funktionaliteten allerede findes i `shared/` eller `core/`
   og genbrug den, i stedet for at skrive noget nyt.
4. Implementér.
5. Gennemgå checklisten nederst i `ARCHITECTURE.md`, før du melder færdig.

## De regler der oftest bliver brudt

- **Ingen hardcodede farver eller px-værdier i komponenter.** Brug design
  tokens fra `src/styles/_tokens.scss`.
- **Ingen `any`.** Strict TypeScript er slået til, og `noUnusedLocals` /
  `noUnusedParameters` fejler i build.
- **Alle features lazy loades** via `loadChildren` i `src/app/app.routes.ts`.
- **Afhængighedsretning:** `features → shared → core`. Aldrig den anden vej,
  og aldrig feature → feature.
- **CSS-klasser følger BEM** og hører til i komponentens egen `.scss`-fil.
- **Ingen Bootstrap eller andre UI-frameworks.** Genbrugelige UI-elementer
  bygges som egne komponenter i `src/app/shared/components/`.
- **Ingen API-kald i komponenter.** De hører til i en service.
- **Ingen magic strings.** Route-stier samles som konstanter i
  `src/app/core/constants/app-route.ts`.

## Dokumentation

Når du tilføjer eller ændrer væsentlig funktionalitet, skal den relevante
`README.md` opdateres. README-filerne er systemets kodedokumentation.

## Commits

Conventional Commits, f.eks. `feat: add workout log`, `fix: handle empty API
response`, `refactor: extract shared table component`.

## Kommandoer

```bash
npm start            # Angular dev server i browser
npm run build        # Produktionsbuild
npm run android:run  # Byg, synkronisér og kør på Android
npm run ios:run      # Byg, synkronisér og kør på iOS
```

Native builds kræver `JAVA_HOME` sat til Android Studios JDK — se
[`README.md`](README.md).
