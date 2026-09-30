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

Login tager **e-mail eller brugernavn** i ét felt (API'et skelner på `@`, og et brugernavn må
derfor ikke indeholde `@`). Rigtig adgangskode til en konto, hvis e-mail ikke er bekræftet, giver
403 uden tokens: det er ingen fejl – sessionen bliver `pending-verification`, siden går til Hjem,
og bekræftelses-arket åbner (se `features/home/components/verify-email-sheet`).

`Glemt adgangskode` er én formular: e-mail eller brugernavn → "Send link" → den neutrale besked
("Hvis kontoen findes …") med "Send igen". Mailen linker til en side, som **API'et** hoster, hvor
den nye adgangskode vælges to gange – appen ser aldrig tokenet og har derfor hverken kodefelt,
adgangskodefelter eller login bagefter.

## Beslutninger

- **Ingen forretningslogik i siderne.** Alle kald går gennem `AuthApi` og `SessionService` i
  `core/`. Siderne holder kun loading, tilstand og fejltekst. En fejl er altid en `ApiError`;
  siden gemmer `toApiError(error).messageKey` (`core/utils/api.ts`) og oversætter nøglen, så
  teksten følger et sprogskift.
- **Typede reactive forms.** Ét `FormGroup<T>` pr. side, alle kontroller `nonNullable`.
- **Fejllinjen findes kun, når der er en fejl** (`@if`), så den ikke lægger tom luft mellem felt
  og knap. Login: 401/400 → `Forkert brugernavn, e-mail eller adgangskode.` (siger ikke hvad),
  429 → `For mange mislykkede forsøg. …`.
- **Feltet udfyldes** med `SessionService.email()`, som husker e-mailen efter log ud og efter en
  genstart midt i en bekræftelse.

## Kendte afvigelser fra designet

- Login-felterne er `translucent` (den mørke 55 %-bund) efter specen, hvor prototypen bruger
  det almindelige glasfelt. Det er mere læsbart oven på fotoet.
