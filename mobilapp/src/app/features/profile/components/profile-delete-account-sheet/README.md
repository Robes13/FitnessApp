# ProfileDeleteAccountSheet

`app-profile-delete-account-sheet` – bekræftelsen, før brugerens konto slettes (GDPR) –
direkte med "Slet konto" eller ved at trække samtykket tilbage (spec 9.2-3b).

| Input          | Type             | Beskrivelse                                                       |
| -------------- | ---------------- | ----------------------------------------------------------------- |
| `open`         | `boolean`        | Påkrævet                                                          |
| `busy`         | `boolean`        | Sletningen kører: spinner på "Ja, slet min konto", "Annuller" fra |
| `errorMessage` | `string \| null` | Oversat fejltekst, hvis API'et afviste sletningen                 |
| `bodyKey`      | `string \| null` | Forklaringens oversættelsesnøgle; `null` = slet kontos egen tekst |

| Output      | Beskrivelse          |
| ----------- | -------------------- |
| `confirmed` | "Ja, slet min konto" |
| `closed`    | "Annuller"           |

Samme mønster som `ProfileLogoutSheet`: arket er sat med `hideClose`, så hverken luk-knap eller
scrim lukker det. Et utilsigtet tryk må aldrig slette noget, og "Annuller" er den tydelige vej
ud. Escape og Androids tilbageknap virker som "Annuller" (`closeOnEscape`), undtagen mens
sletningen kører. Teksten forklarer, at kontoen og alle data slettes – også på enheden –
og at det ikke kan fortrydes.

Selve sletningen (`SessionService.deleteAccount()`, `DELETE /me`) sker på profilsiden – arket
spørger kun og viser `busy` og `errorMessage` (i en `UiFormError` over knapperne). Fejler
kaldet, slettes intet lokalt.

Samtykkerækken under "Privatliv" bruger samme ark med
`bodyKey="profile.deleteAccountSheet.withdrawBody"` ("Samtykket er en forudsætning for Nutrify.
Trækker du det tilbage, slettes din konto og alle dine data."), og bekræftelsen kalder
`SessionService.withdrawConsent()` (`POST me/consents/Terms/withdraw`). Titel og knapper er de
samme, fordi resultatet er det samme: kontoen slettes.
