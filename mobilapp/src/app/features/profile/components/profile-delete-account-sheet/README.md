# ProfileDeleteAccountSheet

`app-profile-delete-account-sheet` – bekræftelsen, før brugerens konto slettes (GDPR).

| Input          | Type             | Beskrivelse                                                       |
| -------------- | ---------------- | ----------------------------------------------------------------- |
| `open`         | `boolean`        | Påkrævet                                                          |
| `busy`         | `boolean`        | Sletningen kører: spinner på "Ja, slet min konto", "Annuller" fra |
| `errorMessage` | `string \| null` | Oversat fejltekst, hvis API'et afviste sletningen                 |

| Output      | Beskrivelse          |
| ----------- | -------------------- |
| `confirmed` | "Ja, slet min konto" |
| `closed`    | "Annuller"           |

Samme mønster som `ProfileLogoutSheet`: arket er sat med `hideClose`, så hverken luk-knap,
scrim eller Escape lukker det. Et utilsigtet tryk må aldrig slette noget, og "Annuller" er
den tydelige vej ud. Teksten forklarer, at kontoen og alle data slettes – også på enheden –
og at det ikke kan fortrydes.

Selve sletningen (`SessionService.deleteAccount()`, `DELETE /me`) sker på profilsiden – arket
spørger kun og viser `busy` og `errorMessage` (i en `UiFormError` over knapperne). Fejler
kaldet, slettes intet lokalt.
