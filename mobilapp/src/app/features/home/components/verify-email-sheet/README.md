# VerifyEmailSheet

"Tjek din mail" (`app-verify-email-sheet`) – bundarket, der låser Hjem, indtil e-mailen er
bekræftet. Det bruger `app-ui-sheet` med `hideClose`, så hverken luk-knap, scrim eller
Escape kan afvise det.

Arket kan:

- **Ændre mail** – folder et felt ud (typed reactive form). "Gem" validerer med
  `NutritionCalculator.isValidEmail`, skriver adressen på profilen og sender en ny kode.
- **Gensend kode** – `SessionService.resendVerification()`; knappen skifter til
  "Kode sendt ✓" og hjælpeteksten til "Ny kode sendt – tjek også spam.".
- **Tjek igen** – `SessionService.checkVerification()`; ikonet drejer en omgang, teksten går
  fra "Tjekker…" til "Ikke bekræftet", når backenden svarer, at mailen ikke er bekræftet.

Fejler et kald, vises "Noget gik galt. Prøv igen." i `app-ui-form-error` (teksten findes ikke
i designet, som ikke viser fejltilstande her).

## Afvigelse fra designet

Designet har mail-ikonet **over** overskriften. `app-ui-sheet` ejer sin titel (den må ikke
håndrulles i indholdet), så ikonet er lagt i ark-slotten `[sheetHeaderExtra]` til højre for
overskriften.
