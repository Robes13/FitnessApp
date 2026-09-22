# ProfileLogoutSheet

`app-profile-logout-sheet` – bekræftelsen, før brugeren logges ud.

| Input  | Type      | Beskrivelse |
| ------ | --------- | ----------- |
| `open` | `boolean` | Påkrævet    |

| Output      | Beskrivelse      |
| ----------- | ---------------- |
| `confirmed` | "Ja, log mig ud" |
| `closed`    | "Annuller"       |

Arket er sat med `hideClose`. Det betyder ingen luk-knap, og at hverken scrimmen eller
Escape lukker det – som i designet, hvor arket kun har de to knapper. Et utilsigtet tryk
uden for arket må ikke føre til et log ud, og "Annuller" er den tydelige vej ud.

Designet placerer det røde log ud-mærke **over** overskriften. Her ligger det til højre for
den, i arkets `[sheetHeaderExtra]`-plads, fordi `app-ui-sheet` altid tegner overskriften
øverst. Teksten og knapperne er uændrede.

Selve log ud-kaldet (`SessionService.logout()`) sker på profilsiden, ikke her – arket
spørger kun.
