# AccountStep

Signup-trin 1 (`account`, designets `s1`): brugernavn og adgangskode to gange.

- Overskrift `Opret din konto` med orange `konto`, underteksten
  `Vælg et brugernavn og en adgangskode.`
- Tre `app-ui-text-input`-felter i en typed reactive form (`FormGroup<AccountForm>`).
  Formularen skriver videre til kladde-signalerne i `SignupStateService` ved hver
  ændring; servicen ejer valideringen (`canContinue`).
- Hint-linjen (`app-ui-form-error`, tone `accent`) viser først
  `Brugernavnet må ikke indeholde @.` (login skelner e-mail fra brugernavn på `@`), så
  `Brugernavnet skal være 3–50 tegn.`, hvis brugernavnet er påbegyndt, men for kort (begge er
  API'ets regler, ikke i designet), og ellers designets `pwHint`: `Adgangskoderne er ikke ens.` når
  gentagelsen er udfyldt og forskellig, ellers `Mindst 10 tegn.` når koden er for kort. Linjen
  reserverer altid sin højde.
- Felterne har `maxLength` efter API'et: 50 tegn til brugernavnet, 200 til adgangskoderne.

## Beslutninger

- Gentagelsesfeltet får `invalid`, når koderne ikke er ens. Designet bruger en orange
  kant dér; `UiTextInput` har kun den røde fejlkant, så kanten er rød og hint-teksten
  orange som i designet.
- Trinnet har hverken inputs eller outputs — kontrakten kræver, at hvert trin selv
  injicerer `SignupStateService`.
