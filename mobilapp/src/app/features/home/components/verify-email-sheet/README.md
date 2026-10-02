# VerifyEmailSheet

"Tjek din mail" (`app-verify-email-sheet`) – bundarket, der låser Hjem, mens sessionen er
`pending-verification` (kontoen er oprettet eller har logget ind med rigtig adgangskode, men
e-mailen er ikke bekræftet, så der er ingen tokens). Det bruger `app-ui-sheet` med `hideClose`, så
hverken luk-knap, scrim eller Escape kan afvise det. Hjems `[open]="!isAuthenticated()"` lukker det.

Mailen har et link til en side på API'et, der bekræfter e-mailen og beder brugeren gå tilbage til
appen (spec 1.1). Arket kan:

- **Opdage bekræftelsen selv.** Mens arket er åbent, kalder det
  `SessionService.checkVerification()` hvert 5. sekund (`VERIFICATION_POLL_MS`) og hver gang appen
  bliver synlig igen (`visibilitychange` → `visible`, fx tilbage fra mail-appen). API'et har intet
  status-endpoint (det ville åbne for enumeration), så det er et login med adgangskoden i
  hukommelsen: 403 = ikke endnu, 200 = bekræftet og logget ind → sessionen bliver `authenticated`,
  og arket lukker. `exhaustMap` springer et tick over, mens et tjek kører, og pollingen stopper,
  når arket lukker. En fejl (fx ingen forbindelse) vises i `app-ui-form-error`, til et tjek lykkes
  igen, og pollingen fortsætter. Virker adgangskoden ikke mere (401), sender sessionen brugeren til
  login. `DOCUMENT` injiceres (ikke det globale `document`), så specs kan styre det.
- **Send mail igen** – `SessionService.resendVerification()` med den identifikator, brugeren
  oprettede sig eller loggede ind med; hjælpeteksten skifter til "Ny mail sendt – det gamle link
  virker ikke længere." (API'et ugyldiggør ældre links). API'ets side for et ugyldigt link citerer
  præcis knapteksten "Send mail igen".
- **Til login** – stopper pollingen (et tjek undervejs annulleres, så svaret ikke genopliver
  sessionen), og `SessionService.logout()` afslutter den ventende session og går til login.

Er brugeren logget ind med et **brugernavn**, kender sessionen ingen adresse, og teksten siger "din
mail" (`home.verifyEmail.emailFallback`). Ventetilstanden er kun i hukommelsen: efter en genstart er
brugeren gæst med e-mailen udfyldt, logger ind, får 403 og ser arket igen (spec 1.1-6a).

## Afvigelser fra designet

- **"Ændre mail" er fjernet.** API'et kan ikke ændre e-mailen på en ubekræftet konto. I stedet
  står "Til login" på knappens plads, så en bruger med en forkert e-mail ikke sidder fast bag arket.
- **Intet kodefelt og intet "Tjek igen".** Mailen har et link, og appen opdager bekræftelsen selv.
- Designet har mail-ikonet **over** overskriften. `app-ui-sheet` ejer sin titel (den må ikke
  håndrulles i indholdet), så ikonet ligger i ark-slotten `[sheetLeading]`.
