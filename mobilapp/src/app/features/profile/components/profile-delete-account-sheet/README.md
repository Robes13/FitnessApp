# ProfileDeleteAccountSheet

`app-profile-delete-account-sheet` – bekræftelsen, før brugerens konto slettes (GDPR).

| Input  | Type      | Beskrivelse |
| ------ | --------- | ----------- |
| `open` | `boolean` | Påkrævet    |

| Output      | Beskrivelse          |
| ----------- | -------------------- |
| `confirmed` | "Ja, slet min konto" |
| `closed`    | "Annuller"           |

Samme mønster som `ProfileLogoutSheet`: arket er sat med `hideClose`, så hverken luk-knap,
scrim eller Escape lukker det. Et utilsigtet tryk må aldrig slette noget, og "Annuller" er
den tydelige vej ud. Teksten forklarer, at alle data på enheden slettes, og at det ikke kan
fortrydes.

Selve sletningen (`SessionService.deleteAccount()`) sker på profilsiden – arket spørger kun.
