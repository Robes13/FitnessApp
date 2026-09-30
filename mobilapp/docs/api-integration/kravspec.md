# Nutrify – kravspecifikation (uddrag af produktrapporten)

Kilde: produktrapporten "PRØVE-SVENDEPRØVE – Nutrify" (Robert Orlander Pedersen, Janick Kofoed
Larsen, Nicklas Lindegaard Martlev Gustavsen). Her står use cases, ikke-funktionelle krav,
acceptkriterier og kodestandarder, så app og API kan holdes op imod dem. Rapporten er stadig en
kladde; hvor den er selvmodsigende eller urealistisk, gælder beslutningerne i `plan.md`.

Nutrify er en fitness- og ernæringsapp, der gør det nemt at registrere og holde overblik over
kalorieindtag, vægt og personlige mål ét sted.

## 1. Konto & autentificering

**1.0 Registrér ny bruger (gæst).** Trigger: "Opret konto" på login-skærmen. Forløb: brugernavn,
password + gentag → fødselsdato → køn → vægt → højde → dagligt aktivitetsniveau (skridt) → hvor ofte
man træner → længde på en typisk træning → intensitet → mål (tabe/holde/tage på) → målvægt → tempo
→ ønsker notifikationer? → oversigt og bekræftelse → e-mail → accept af servicevilkår → systemet
opretter brugeren som **ikke aktiv** → brugeren skal validere sin mail (1.1).
Alternativer: 1a brugernavn optaget · 1b password lever ikke op til kravene (vis kravene) · 1c
password ≠ gentag · 2a–6a ugyldige/urealistiske værdier markeres · 2b under aldersgrænsen · 10a
"holde vægten" springer målvægt og tempo over · 11a målvægt passer ikke til målet · 14a gå tilbage
og ret · 15a ugyldigt e-mailformat · 15b e-mail optaget · 16a vilkår ikke accepteret → ingen konto.

**1.1 Validér e-mail.** Efter registrering vises en modal: "der er sendt en mail – brug linket".
Systemet sender en mail med et **unikt link**; brugeren trykker på linket → e-mailen valideres og
kontoen aktiveres → **appen registrerer valideringen og lukker modalen automatisk** → "Hjem".
Alternativer: 3a "Send mail igen" (det gamle link bliver ugyldigt) · 4a link udløbet/ugyldigt →
besked + ny mail · 6a appen opdager det ikke automatisk → genåbn appen eller log ind igen.

**1.2 Log ind.** Brugernavn + password → "Log ind" → kontrol af oplysninger → kontrol af, at brugeren
er aktiveret → JWT med kort levetid + refresh token med 30 dages levetid; begge gemmes på enheden,
refresh token også i databasen → "Hjem".
Alternativer: 3a forkert brugernavn/password (sig ikke hvilket) · 3b **for mange mislykkede forsøg →
midlertidig blokering + besked** · 4a e-mail ikke valideret → ingen tokens, vis modalen fra 1.1.

**1.3 Log ud** (fra "Profil"): bekræftelsesdialog (2a/2b annullér) → refresh token ugyldiggøres og
fjernes fra databasen → tokens fjernes fra enheden → login-skærmen.

**1.4 Gendan konto / glemt adgangskode.** "Glemt adgangskode" → e-mail **eller brugernavn** → reset
token med begrænset levetid i databasen → mail med unikt link → besked "der er sendt en mail, hvis
kontoen findes" → brugeren trykker på linket → token kontrolleres → **en side**, hvor ny adgangskode
indtastes to gange → ny adgangskode gemmes, reset token markeres brugt, eksisterende refresh tokens
revokeres → bekræftelse og videre til login.
Alternativer: 2a ukendt konto → samme besked, ingen mail · 6a send igen → nyt token, det gamle
revokeres · 7a link udløbet/ugyldigt/brugt → besked + nyt link · 9a krav til adgangskode · 9b ikke
ens.

**1.5 Forny refresh token.** Når appen åbnes, sendes refresh token til serveren; er det gyldigt og
**ikke udstedt i dag**, fornyes det til 30 dage fra i dag; er det udstedt i dag, forbliver det
uændret. Udløbet/ugyldigt → tokens fjernes, login-skærmen.

**1.5b Forny access token.** Når et kald kræver serveren, og JWT er udløbet/mangler, sendes refresh
token for at få en ny JWT, som gemmes, og den oprindelige handling gennemføres. Udløbet/ugyldigt
refresh token → login-skærmen.

## 2. Profil & personlige oplysninger (alt på siden "Profil")

- **2.0 Opdatér e-mail:** ny adresse gemmes og markeres ikke valideret, valideringsmail sendes,
  bekræftelse vises; den nye e-mail skal valideres (1.1), før den er fuldt aktiv. 3a ugyldig · 3b
  optaget · 4a fortryd.
- **2.1 Højde · 2.2 Fødselsdato · 2.3 Køn · 2.5 Aktivitetsniveau (skridt) · 2.7 Træningsvaner
  (gange/uge, varighed, intensitet) · 2.8 Personlige mål (tabe/holde/tage på + tempo; "holde"
  springer tempo over):** vis nuværende værdi → ny værdi → gem → systemet **genberegner daglige
  kalorie- og makromål** (5.0). Ugyldige værdier markeres; fortryd = uændret.
- **2.4 Profilbillede:** tryk på billedet → galleri eller kamera → evt. beskæring → bekræft → gemmes
  og vises overalt. 3a tilladelse mangler · 4a billedet overholder ikke kravene · 6a fortryd.
- **2.6 (System) Hent aktivitetsniveau** fra Health Connect/Apple Health én gang om måneden, hvis der
  er givet tilladelse, og genberegn målene.

## 3. Madlogning (siden "Mad")

- **3.0 Log madvare manuelt:** navn, mængde, kalorier, protein/fedt/kulhydrat → gem → madvaren
  oprettes **kun for brugeren** og logges på dagen → samlet indtag opdateres. 3a navnet findes
  allerede · 4a–6a ugyldige værdier · 7a påkrævet felt mangler.
- **3.1 Log med stregkode:** kamera → stregkode genkendes → opslag → vis kalorier og næring → (8a
  justér mængde, genberegn) → log. 3a kameratilladelse · 5a kan ikke aflæses · 6a ikke fundet →
  tilbyd manuel oprettelse · 8b fortryd.
- **3.2 Log eksisterende madvare eller madsamling:** søg/vælg → vis næring → mængde → genberegn →
  **vælg måltidstype (morgenmad, middagsmad, aftensmad eller snack)** → log på dagen og
  måltidstypen. 3a ikke fundet → tilbyd manuel/stregkode · 5a ugyldig mængde · fortryd.
- **3.3 Redigér logget mængde** → genberegn → samlet indtag opdateres.
- **3.4 Fjern logget madvare/samling** med bekræftelse → samlet indtag genberegnes. 6a ikke fundet →
  fejlbesked.

## 4. Madsamlinger (siden "Mad")

- **4.0 Opret:** navn → søg og vælg madvarer + mængder (gentag) → systemet beregner samlet
  næring → opret. 4a ikke fundet → manuel/stregkode · 6a fjern en vare · **8a mindst én vare** ·
  8b fortryd.
- **4.1 Redigér:** tilføj/fjern varer og ret mængder, næring genberegnes løbende, gem. 8a mindst én
  vare.
- **4.2 Slet** med bekræftelse.

## 5. Kalorie- og næringsmål

- **5.0 (System) Beregn dagligt kaloriemål** ved registrering, d. 1. i hver måned og ved relevante
  ændringer: BMR (alder, køn, højde, vægt) → TDEE (aktivitet + træning) → justér efter mål og tempo
  → gem. "Holde vægt" = TDEE. Under sikker minimumsgrænse → løft til grænsen og informér.
- **5.1 (System) Beregn makromål** (protein/fedt/kulhydrat i gram) ud fra kaloriemålet og målet.
- **5.2 Se dagens kalorieindtag** på "Hjem" (0 hvis intet er logget; fejl → besked + genindlæs).
- **5.3 Se dagens kaloriemål** på "Hjem" ved siden af indtaget.
- **5.4 Se tidligere kalorieindtag:** de seneste 7 dage på "Hjem"; tryk på en dag; "åbn mere" →
  hele måneden.
- **5.5 Se tidligere makroindtag:** de seneste 7 dage (og hele måneden) pr. dag.

## 6. Vægtregistrering (siden "Vægt")

- **6.0 Registrér vægt:** "Registrer vægt" → vægt → gem med dags dato → seneste vægt opdateres, mål
  genberegnes. 3a ugyldig · **4a der findes allerede en vejning i dag → spørg, om den skal
  overskrives** · 4b fortryd.
- **6.1 Se seneste vægt** (ingen vejninger → startvægten fra registreringen).
- **6.2 Redigér seneste vægt** – ikke startvægten fra registreringen (2a → besked om at lave en ny
  registrering først).
- **6.3 Se vejninger som graf** for 1 uge, 3 uger eller 3 måneder (tom graf, fejl → genindlæs).

## 7. Historik (siden "Historik")

- **7.0** Kronologisk oversigt over relevante hændelser fra registrering til nu, **grupperet efter
  dag, nyeste øverst**, og **flere indlæses løbende, når brugeren scroller**. Kun registrering →
  vis kun den. Fejl → besked + genindlæs.

## 8. Notifikationer

- **8.0 Vælg påmindelser** på "Profil": vis nuværende valg → slå til/fra → gem. 4a enhedens
  tilladelse mangler → bed om den.
- **8.1 (System) Send påmindelser**, når en hændelse indtræffer, og brugeren har slået typen til.

## 9. Databeskyttelse & samtykke (GDPR, siden "Profil")

- **9.0 Slet konto:** bekræft → personhenførbare data anonymiseres, øvrige data slettes, tokens
  ugyldiggøres, brugeren logges ud og sendes til login.
- **9.1 Download min data:** struktureret, maskinlæsbart format, downloades på enheden.
- **9.2 Træk samtykke tilbage:** oversigt over samtykker → vælg → bekræft → registreret som trukket
  tilbage. 3a Health Connect/Apple Health → stop automatisk skridtindhentning. **3b samtykke til
  behandling af sundheds- og profildata er en forudsætning for appen → tilbagetrækning = slet konto
  (9.0) efter bekræftelse.**

## Ikke-funktionelle krav (FURPS)

- Usability: registrering uden hjælp på få minutter · **dansk og engelsk** · forståelige fejlbeskeder.
- Reliability: ved scanningsfejl kan næring indtastes manuelt · refresh token sikrer, at brugeren
  ikke logges ud uventet inden for 30 dage.
- Performance: stregkode → visning ≤ 2 s · API-svartid for almindelige kald ≤ 300–500 ms.
- Supportability: kodestandarder i .NET, PostgreSQL og Ionic · **databaseændringer via migrations** ·
  **ingen logning af følsomme data (login, tokens)** · lagdelt arkitektur.

## Acceptkriterier (konto)

- Registrering med gyldige oplysninger og accepterede vilkår opretter brugeren og gemmer alt.
- Optaget brugernavn afvises med besked. Ugyldige værdier (fremtidig fødselsdato, negativ vægt/
  højde) afvises og markeres. Svagt password afvises med kravene. Under aldersgrænsen → ingen konto.
- Vilkår ikke accepteret eller afbrudt → ingen bruger. Passwords gemmes hashet.

## Kodestandarder (uddrag)

- **.NET API:** Microsofts C#-konventioner (PascalCase for typer/metoder/properties, camelCase for
  lokale, `_camelCase` for private felter). Controllers = HTTP, services = forretningslogik, EF Core
  = dataadgang, DTO'er udadtil (entiteter eksponeres ikke). async/await, aldrig `.Result`/`.Wait()`.
  Validering i API'et, central exception handling, ingen logning af passwords/tokens.
- **PostgreSQL:** ensartet navngivning; PK efter entiteten (`UserId`, `FoodId`, `FoodLogId`), FK med
  samme navn som den PK, de peger på; PK/FK/unique/NOT NULL-constraints og indexes på hyppige
  opslag; EF Core migrations; faste værdier som enums i backend, dynamiske data som tabeller.
- **Ionic/Angular-app:** se `mobilapp/ARCHITECTURE.md` (core/shared/features, OnPush, signals, BEM,
  design tokens, strict TypeScript, API-kald kun i services, loading/empty/error-states).
