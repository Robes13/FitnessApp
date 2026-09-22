# Auth

De to skærme, en udlogget bruger kan se: **Login** og **Glemt adgangskode**. Begge ligger bag
`guestGuard`, så en logget ind bruger sendes videre til Hjem.

| Fil / mappe                           | Indhold                                                         |
| ------------------------------------- | --------------------------------------------------------------- |
| `auth.routes.ts`                      | `AUTH_ROUTES` – `/login` → `LoginPage`.                         |
| `forgot-password.routes.ts`           | `FORGOT_PASSWORD_ROUTES` – `/glemt-adgangskode`.                |
| `auth-assets.ts`                      | `AUTH_ASSET` – stierne til fotoet og logoet i `public/images/`. |
| `auth-error.ts`                       | `authErrorMessage()` – `ApiError` → dansk tekst til brugeren.   |
| [`components/`](components/README.md) | Feature-komponenter (fotobaggrunden).                           |
| [`pages/`](pages/README.md)           | Route-komponenterne.                                            |

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

## Beslutninger

- **Ingen forretningslogik i siderne.** Alle kald går gennem `AuthApi`, `SessionService`,
  `UserProfileService` og `NutritionCalculator` i `core/`. Siderne holder kun trin, loading og
  fejltekst.
- **Typede reactive forms.** Ét `FormGroup<T>` pr. trin, alle kontroller `nonNullable`.
  Feltværdierne læses som signals med `toSignal(control.valueChanges)`, så hints og
  disabled-tilstande er `computed()` og ikke logik i templaten.
- **Fejl fra backenden slår designets hint.** Under feltet står enten designets orange hint
  (`Skriv en gyldig e-mail.`, `Koden er 4 cifre.`, `Mindst 8 tegn.`,
  `Adgangskoderne er ikke ens.`) eller en rød fejltekst fra `AuthApi` – aldrig begge. Det
  afgøres ét sted i `message()`.
- **Ventetiden er en token.** Kvitteringstrinnet venter `FORGOT_PASSWORD_DONE_DELAY_MS`
  (1400 ms som i designet), før der logges ind. Tokenet kan sættes til 0 i tests, og timeren
  ryddes af `takeUntilDestroyed`, hvis brugeren forlader siden inden.
- **Brugernavnet til det afsluttende login** er profilens **rå** brugernavn
  (`profile().username`), ikke `displayName()` – `SessionService.login()` gemmer det, den får,
  så demo-navnet ville ellers blive skrevet ind i en tom profil. Er brugernavnet tomt, sendes
  brugeren til `/login` i stedet.

## Kendte afvigelser fra designet

- Login-felterne er `translucent` (den mørke 55 %-bund) efter specen, hvor prototypen bruger
  det almindelige glasfelt. Det er mere læsbart oven på fotoet.
