# AuthBackdrop

`app-auth-backdrop` – fotobaggrunden bag login og glemt adgangskode
(`public/images/login-bg.jpg`). Værten er `position: absolute; inset: 0`, så siden selv kan
lægge sit indhold ovenpå i et almindeligt flow.

| Fil                  | Indhold                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `auth-backdrop.ts`   | Komponenten. Ét input: `gradient`. Billedstien kommer fra `AUTH_ASSET`.   |
| `auth-backdrop.html` | `<img>` + forløbet i `@if (gradient())`.                                  |
| `auth-backdrop.scss` | `object-fit: cover`, `object-position: top` og designets lodrette forløb. |

## Beslutninger

- **Billedet er dekoration.** `alt=""` og `aria-hidden` på værten, så skærmlæsere springer det
  over – al information står i teksten ovenpå.
- **Forløbet er et input, ikke en kopi.** Login lægger teksten på fotoets i forvejen mørke del
  og har intet forløb; glemt adgangskode har fire tekstafsnit i bunden og har brug for det.
- **Forløbet er ens i begge temaer.** Det kommer fra `--gradient-photo-overlay`, som er
  defineret én gang i `_tokens.scss` og ikke har en lys-override – fotoskærmene er altid mørke.
