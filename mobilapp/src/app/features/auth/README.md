# Auth

De to skærme, en udlogget bruger kan se: **Login** og **Glemt adgangskode**. Begge ligger bag
`guestGuard`, så en logget ind bruger sendes videre til Hjem.

| Fil / mappe                           | Indhold                                                            |
| ------------------------------------- | ------------------------------------------------------------------ |
| `auth.routes.ts`                      | `AUTH_ROUTES` – `/login` → `LoginPage`.                            |
| `forgot-password.routes.ts`           | `FORGOT_PASSWORD_ROUTES` – `/glemt-adgangskode`.                   |
| `auth-assets.ts`                      | `AUTH_ASSET` – stierne til fotoet og logoet i `public/images/`.    |
| `photo-screen.ts`                     | `holdDarkSystemBarsWhileOpen()` – lyse bar-ikoner på fotoskærmene. |
| [`components/`](components/README.md) | Feature-komponenter (fotobaggrunden).                              |
| [`pages/`](pages/README.md)           | Route-komponenterne.                                               |

## Altid mørke

Begge skærme ligger på et mørkt foto og er derfor mørke i begge temaer: værten binder
`data-theme` til `PHOTO_SCREEN_THEME` (`'dark'`), så tokens under den får de mørke værdier også
i lyst tema, og konstruktøren kalder `holdDarkSystemBarsWhileOpen()`, så statusbarens ikoner
er lyse, mens skærmen er åben. Se "Tema" i [`src/styles/README.md`](../../../styles/README.md).

## Flow

```
/login ──"Opret konto"──────────→ /opret
   │  ──"Glemt adgangskode?"───→ /glemt-adgangskode
   │                                   │
   └──← "Log ind" / tilbage ───────────┘
   │
   └──"Log ind" (SessionService) ─→ /hjem
```

`Glemt adgangskode` er én rute med fire trin i et signal (designets `fp1 → fp2 → fp3 →
fpDone`): e-mail → kode → ny adgangskode → kvittering. Trinnene har bevidst **ikke** hver sin
URL – de er ét sammenhængende forløb, og en genindlæsning midt i det ville alligevel ikke have
nogen kode at fortsætte med.

API'et logger ind med **e-mail** (ikke brugernavn). "Koden" i mails er et token på 64 tegn
(0–9, A–F), som brugeren kopierer og indsætter; der er ingen kort kode og intet link.

## Beslutninger

- **Ingen forretningslogik i siderne.** Alle kald går gennem `AuthApi`, `SessionService`,
  `UserProfileService` og `NutritionCalculator` i `core/`. Siderne holder kun trin, loading og
  fejltekst. En fejl er altid en `ApiError`; siden gemmer `toApiError(error).messageKey`
  (`core/utils/api.ts`) og oversætter nøglen, så teksten følger et sprogskift.
- **Typede reactive forms.** Ét `FormGroup<T>` pr. trin, alle kontroller `nonNullable`.
  Feltværdierne læses som signals med `toSignal(control.valueChanges)`, så hints og
  disabled-tilstande er `computed()` og ikke logik i templaten.
- **Fejl fra backenden slår designets hint.** Under feltet står enten designets orange hint
  (`Skriv en gyldig e-mail.`, `Koden passer ikke. …`, `Mindst 10 tegn.`,
  `Adgangskoderne er ikke ens.`) eller en rød fejltekst fra API'et – aldrig begge. Det
  afgøres ét sted i `message()`.
- **Ventetiden er en token.** Kvitteringstrinnet venter `FORGOT_PASSWORD_DONE_DELAY_MS`
  (1400 ms som i designet), før der logges ind. Tokenet kan sættes til 0 i tests, og timeren
  ryddes af `takeUntilDestroyed`, hvis brugeren forlader siden inden.
- **E-mailen til det afsluttende login** er den fra trin 1. Fejler loginet (tokenet er brugt
  nu), sendes brugeren til `/login` i stedet for tilbage til trin 3.
- **E-mailen udfyldes** fra sessionen (`SessionService.email()`), som husker den efter log ud
  og efter en bekræftelse, der ikke selv kunne logge ind.

## Kendte afvigelser fra designet

- Login-felterne er `translucent` (den mørke 55 %-bund) efter specen, hvor prototypen bruger
  det almindelige glasfelt. Det er mere læsbart oven på fotoet.
