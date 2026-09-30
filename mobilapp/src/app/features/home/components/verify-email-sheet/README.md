# VerifyEmailSheet

"Tjek din mail" (`app-verify-email-sheet`) – bundarket, der låser Hjem, mens sessionen er
`pending-verification` (kontoen er oprettet, men e-mailen er ikke bekræftet, så der er ingen
tokens). Det bruger `app-ui-sheet` med `hideClose`, så hverken luk-knap, scrim eller Escape kan
afvise det.

API'et sender en ren tekstmail med et token på 64 tegn (0–9, A–F) – intet link og ingen kort kode.
Arket kan:

- **Bekræft** – brugeren indsætter koden i feltet, og `SessionService.verifyEmail()` sender
  `POST auth/email/verify`. Det indsatte normaliseres (mellemrum væk, store bogstaver), og
  knappen er slået fra, indtil det passer til `AUTH_TOKEN_PATTERN`. Har sessionen stadig
  adgangskoden fra oprettelsen i hukommelsen, logges brugeren ind, og Hjem låses op. Er appen
  genstartet siden, bliver sessionen gæst, og brugeren sendes til login med e-mailen udfyldt.
  Gik bekræftelsen igennem, men fejlede login bagefter (fx intet net), prøver næste tryk på
  "Bekræft" kun login igen – koden er brugt og ville ellers give "Koden passer ikke".
- **Gensend kode** – `SessionService.resendVerification()`; knappen skifter til
  "Kode sendt ✓" og hjælpeteksten til "Ny kode sendt – tjek også spam.". Et gensend
  ugyldiggør den forrige kode.
- **Tjek igen** – `SessionService.checkVerification()`. API'et har intet status-endpoint, så
  det er et login-forsøg med adgangskoden fra oprettelsen: lykkes det, er mailen bekræftet;
  401 betyder "ikke endnu", og teksten går fra "Tjekker…" til "Ikke bekræftet". Uden
  adgangskoden i hukommelsen (appen er genstartet) kan intet tjekkes: i stedet for et falsk
  "Ikke bekræftet" vises en fejllinje om at indsætte koden fra mailen eller gå til login, hvis
  mailen allerede er bekræftet.
- **Til login** – `SessionService.logout()` afslutter den ventende session og går til login.

Knapperne viser `UiButton`s spinner, mens deres kald kører, og en fejl vises i
`app-ui-form-error` som en oversat nøgle (`toApiError(error).messageKey`), fx
"Koden passer ikke. Kopiér hele koden fra den nyeste mail." ved en brugt eller udløbet kode.

## Afvigelser fra designet

- **"Ændre mail" er fjernet.** API'et kan ikke ændre e-mailen på en ubekræftet konto
  (`PATCH /me` kræver et bekræftet token, og en ny oprettelse med samme brugernavn giver 409).
  I stedet står "Til login" på knappens plads, så en bruger med en forkert e-mail ikke sidder
  fast bag arket. Det er et gap i API'et (e-mailskift før bekræftelse).
- **Kodefelt.** Designet har intet felt; tokenet skal indsættes, fordi mailen ikke har et link.
- Designet har mail-ikonet **over** overskriften. `app-ui-sheet` ejer sin titel (den må ikke
  håndrulles i indholdet), så ikonet ligger i ark-slotten `[sheetLeading]`.
