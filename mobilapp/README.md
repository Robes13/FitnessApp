# Mobilapp

Mobil app bygget med **Angular 22** og pakket som native iOS- og
Android-app med **Capacitor 8**. Der er ingen desktop-visning — layoutet er
phone-first.

> **Læs [`ARCHITECTURE.md`](ARCHITECTURE.md), før du skriver kode.** Det er
> projektets bindende regelsæt.

---

## Indhold

| Dokument                                       | Beskriver                               |
| ---------------------------------------------- | --------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)           | Arkitektur- og kodregler (bindende)     |
| [`CLAUDE.md`](CLAUDE.md)                       | Instruktion til AI-assistenter i repoet |
| [`src/styles/README.md`](src/styles/README.md) | Design tokens og global styling         |
| [`src/i18n/README.md`](src/i18n/README.md)     | Oversættelse (ngx-translate) og sprog   |

---

## Teknologivalg

| Valg                                       | Begrundelse                                         |
| ------------------------------------------ | --------------------------------------------------- |
| Angular 22, standalone components, signals | Projektets krav; ingen NgModules                    |
| Zoneless change detection                  | Angular-standard fra v20; færre uventede re-renders |
| Capacitor 8                                | Native iOS/Android-skal omkring den samme web-build |
| **SPM** til iOS-afhængigheder              | Ingen CocoaPods-installation nødvendig              |
| SCSS med CSS-variabler                     | Design tokens kan skifte tema i runtime             |
| Intet UI-framework                         | Kravet er systemets eget design — ingen Bootstrap   |
| ngx-translate (`da.json` / `en.json`)      | Sprogskift live i appen, uden reload                |

---

## Forudsætninger

| Værktøj              | Version | Note                               |
| -------------------- | ------- | ---------------------------------- |
| Node.js              | 24+     |                                    |
| Xcode                | 26+     | Til iOS                            |
| Android Studio       | Nyeste  | Leverer både Android SDK og en JDK |
| Android SDK Platform | 36      | `compileSdk` for Capacitor 8       |
| JDK                  | 21      | Følger med Android Studio          |

### Miljøvariabler

Gradle skal kunne finde en JDK. Android Studios medfølgende JDK bruges:

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator"
```

Læg linjerne i `~/.zshrc`, så de gælder i alle terminaler.

---

## Kom i gang

```bash
npm install
npm start
```

Appen kører nu på <http://localhost:4200>. Konto og login kræver API'et – se næste afsnit.

---

## Kør med API'et (Docker)

Appen taler med FitnessApp-API'et i `../API` (ASP.NET Core). `dotnet` er ikke nødvendigt:
API'et køres i Docker på <http://localhost:5210> med `ASPNETCORE_ENVIRONMENT=Development`.
Compose-filen ligger **uden for repoet** indtil videre. Den starter Postgres, kører
migrationerne, bygger API'et fra `API/Dockerfile` og monterer API'ets `.dev-outbox` i en lokal
mappe.

```bash
docker compose -f <sti-til>/compose.yml up -d --build
curl http://localhost:5210/health   # → Healthy
npm start                           # http://localhost:4200 – /api går videre til :5210
```

- **Browser:** API'et har ingen CORS-politik. `npm start` bruger derfor `proxy.conf.json`
  (`angular.json` → `serve.options.proxyConfig`): appen kalder `/api/v1` relativt, og
  dev-serveren sender kaldet videre til `http://localhost:5210`.
- **Native:** `CapacitorHttp` er slået til i `capacitor.config.ts`, så kaldene går gennem den
  native HTTP-stak, og WebView'ets CORS-regler gælder ikke. `API_BASE_URL`
  (`src/app/core/constants/api.ts`) er `http://10.0.2.2:5210/api/v1` på Android-emulatoren og
  `http://localhost:5210/api/v1` i iOS-simulatoren. En fysisk enhed skal bruge Mac'ens LAN-IP,
  og en produktions-URL findes ikke endnu.
- **Android og `http://`:** Android blokerer klartekst-HTTP som standard. Kun **debug**-buildet
  har en network-security-config (`android/app/src/debug/res/xml/network_security_config.xml`),
  der tillader klartekst til `10.0.2.2` og `localhost` – dev-API'et. Release-buildet er uden
  klartekst. **iOS** har `NSAllowsLocalNetworking` i `Info.plist`, så `http://localhost:5210` må
  kaldes; en LAN-IP kræver en egen ATS-undtagelse.
- **Mails i dev:** API'et sender ingen rigtige mails i Development, men skriver dem som
  `.txt`-filer i outbox-mappen (første linje `To: <e-mail>`). Bekræftelses- og nulstillingsmailen
  har et link til en side på API'et, som åbnes i browseren.

---

## Kør på Android

```bash
emulator -avd <navn-på-din-avd> &
npm run android:run
```

Eller manuelt:

```bash
npm run sync
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n dk.meploy.fitnessapp/.MainActivity
```

Åbn projektet i Android Studio med `npm run android:open`.

**Minimum WebView:** `capacitor.config.ts` kræver **Android System WebView 119+**
(`android.minWebViewVersion`), som er Angular 22's Chrome-minimum. På ældre WebViews viser
Capacitor den statiske side `public/webview-error.html`, der beder brugeren opdatere via
Google Play, i stedet for en tom skærm. Emulatorer med fabriks-WebView skal derfor
opdateres via Play Store, før appen kan testes.

---

## Kør på iOS

```bash
npm run ios:run
```

Eller manuelt:

```bash
npm run sync
cd ios/App
xcodebuild -project App.xcodeproj -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted dk.meploy.fitnessapp
```

Byg **uden** `CODE_SIGNING_ALLOWED=NO`: simulator-buildet signeres "Sign to Run Locally" (intet
team nødvendigt), og kun sådan kommer HealthKit-entitlementet med – ellers kan appen ikke læse
skridt (se "Skridt fra Apple Sundhed / Health Connect").

Åbn projektet i Xcode med `npm run ios:open`.

**Bemærk:** iOS-projektet bruger **Swift Package Manager**, ikke CocoaPods.
Der skal derfor ikke køres `pod install`.

#### Hvis `xcodebuild` ser ud til at hænge første gang

SwiftPM slår op i macOS-nøgleringen, før den henter Capacitors
xcframeworks fra GitHub. Første gang viser macOS derfor en dialog
(«xcodebuild vil bruge fortrolige oplysninger …»), og buildet står stille,
indtil den besvares. Klik **Tillad** eller **Afvis** — begge dele virker,
for filerne på GitHub er offentlige og kræver ikke login.

---

## Skærmretning

Appen er låst til portræt på telefoner (`UISupportedInterfaceOrientations` i `Info.plist` og
`android:screenOrientation="portrait"` i `AndroidManifest.xml`); iPad og store Android-skærme
(≥ 600 dp, Android 16+) er ikke låst.

---

## Tilbageknappen (Android)

`@capacitor/app` håndterer Androids tilbageknap og -gestus i `BackButtonService`: et åbent ark
eller stregkodescanneren lukkes først, ellers går appen tilbage i historikken, og kun når der
ikke er mere historik, minimeres appen. Uden servicen lukker Capacitor appen ved hvert tryk.

---

## Tastaturet

Skærmtastaturet må aldrig skubbe WebView'et. I `capacitor.config.ts` er `ios.scrollEnabled`
derfor `false`, og `@capacitor/keyboard` kører med `resize: 'none'`. I stedet gør layoutet selv
plads: `KeyboardService` sætter `--keyboard-inset` og `data-keyboard="open"` på `<html>`, og
app-roden bliver `100dvh − --keyboard-inset`. Alle skærme er bygget på `height: 100%`, så de
lægger sig over tastaturet. Sheets lander lige over det, footer-knapper forbliver synlige, og
det fokuserede felt scrolles frem i sit eget scroll-område. Tab-baren skjules, mens tastaturet
er åbent. Kamerarammen i stregkodescanneren og signup-forløbets ring og kapitelnavne gør plads
for felterne, og signup-trinnet scroller, hvis det stadig ikke passer. Et tryk uden for et
tekstfelt lukker tastaturet, fordi iOS ikke viser en "Færdig"-knap i et WebView.

Nye skærme med tekstfelter skal derfor bygges på højden af deres forælder (`height: 100%`, flex
og egne scroll-områder), ikke på `100vh`, `position: fixed` eller dokumentets scroll. Ellers
tager de ikke højde for tastaturet. På Android ændrer systemet selv WebView'ets størrelse, så
dér bliver `--keyboard-inset` 0.

## Status- og navigationsbar

Barerne følger appens eget tema, ikke telefonens: `ThemeService` styler dem via Capacitors
indbyggede `SystemBars` (lyse ikoner i mørkt tema, mørke i lyst), og fotoskærmene holder dem
mørke, fordi fotoet er mørkt i begge temaer. På Android farver det lille app-plugin
`AppWindowPlugin.java` desuden vinduet bag WebView'et, for på WebView-versioner uden
edge-to-edge-understøttelse ligger barerne på vinduet og ikke på siden. Vinduets
startfarve (`app_background` i `res/values/colors.xml`) er den mørke baggrund, så der ikke
blinker hvidt ved opstart.

## Påmindelser (lokale notifikationer)

Påmindelserne bruger `@capacitor/local-notifications`. Pluginet skal synkroniseres ind i
de native projekter, før det virker på en enhed:

```bash
npm run sync   # ng build + cap sync – registrerer pluginet i android/ og ios/
```

- **Android:** Pluginets eget manifest flettes ind ved build og tilføjer
  `POST_NOTIFICATIONS` (Android 13+ spørger brugeren), `SCHEDULE_EXACT_ALARM`,
  `RECEIVE_BOOT_COMPLETED` og `WAKE_LOCK`. Appens `AndroidManifest.xml` skal derfor ikke
  ændres. Påmindelserne planlægges bevidst **ikke** som eksakte alarmer – de kan komme et
  par minutter forsinket, men brugeren skal ikke give lov til eksakte alarmer. Efter en
  genstart af telefonen genplanlægger pluginet selv.
- **iOS:** Ingen `Info.plist`-nøgle kræves; appen beder om lov, første gang brugeren slår
  en påmindelse eller "Notifikationer" til.
- **Browser:** Der planlægges intet. Indstillingerne gemmes stadig, og arket viser, at
  påmindelser kun virker i appen.

## Stregkodescanner (kamera og Open Food Facts)

Scanneren bruger `@capacitor-mlkit/barcode-scanning` og dets færdige `scan()`-UI (EAN-13,
EAN-8, UPC-A, UPC-E). Varen slås op i [Open Food Facts](https://world.openfoodfacts.org)
(API v2, næringsværdier pr. 100 g). Pluginet skal synkroniseres ind i de native projekter:

```bash
npm run sync   # ng build + cap sync
```

- **Android:** `scan()` er Googles kodescanner fra Play Services – den kræver **ikke**
  kameratilladelse, men Googles stregkodemodul. `AndroidManifest.xml` har derfor
  `com.google.mlkit.vision.DEPENDENCIES = barcode_ui`, så modulet hentes, når appen
  installeres. Mangler det alligevel, starter appen installationen og beder brugeren prøve
  igen om et øjeblik. `CAMERA`-tilladelsen står i manifestet som pluginets dokumentation
  kræver, og `android.hardware.camera` er `required="false"`, så enheder uden kamera stadig
  kan installere appen og indtaste stregkoden.
- **iOS:** `Info.plist` har `NSCameraUsageDescription`. Appen spørger om kameraadgang første
  gang; afviser brugeren, forklarer scanneren det og tilbyder "Åbn indstillinger".
  **Obs:** ML Kit-pluginet understøtter kun CocoaPods, mens iOS-projektet bruger Swift
  Package Manager (`ios/App/CapApp-SPM`). `cap sync` tager det derfor ikke med på iOS, og
  scanneren falder tilbage til at indtaste stregkoden, indtil projektet flyttes til
  CocoaPods (med `platform :ios, '15.5'` i `Podfile`) eller pluginet skiftes ud.
- **Browser:** Intet kamera. Scanneren viser et felt til stregkodens tal (8–14 cifre), og
  opslaget kører som i appen – så hele forløbet kan testes med `npm start`.
- Fundne varer gemmes lokalt pr. stregkode (`nutrify.product-cache`, højst 100), så en vare,
  der er scannet før, også virker offline.

## Skridt fra Apple Sundhed / Health Connect

Spec 2.6 og 9.2-3a: Profil → Privatliv har på en telefon rækken "Skridt fra Apple Sundhed" (iOS) /
"Skridt fra Health Connect" (Android). Slået til læser appen skridtene for de seneste 28 hele dage
og sender kun gennemsnittet (`PUT me/profile/activity`) – med det samme og derefter ved app-start,
når der er gået 30 dage siden sidste vellykkede opdatering (indtil da prøves der ved hver start); slået
fra trækkes samtykket tilbage. Logikken: `core/services/step-sync/` (se `src/app/core/services/README.md`).
Pluginet er `@capgo/capacitor-health` (v8, HealthKit + Health Connect, SPM); kun
`core/services/step-sync/health-platform.ts` kalder det. Efter `npm install`: `npm run sync`.

- **Android:**
  - `minSdkVersion` er **26** (`android/variables.gradle`), Health Connects minimum (Android 8).
    Android 7 understøttes derfor ikke længere. Health Connect er indbygget fra Android 14; ældre
    telefoner skal hente "Health Connect" i Play Butik.
  - Pluginets manifest erklærer ~48 sundhedstilladelser. `app/src/main/AndroidManifest.xml` fjerner
    dem alle med `tools:node="remove"` undtagen `android.permission.health.READ_STEPS`. Tjek det
    flettede manifest efter et build:
    `android/app/build/intermediates/merged_manifest/<variant>/process<Variant>MainManifest/AndroidManifest.xml`.
  - Health Connect viser kun sin tilladelsesdialog, når appen har "privatlivspolitik"-indgangene.
    Pluginets manifest leverer dem: `PermissionsRationaleActivity`
    (`androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`, Android ≤ 13) og aliasset
    `ViewPermissionUsageActivity` (`VIEW_PERMISSION_USAGE` + `HEALTH_PERMISSIONS`, Android 14+).
    Linket "privatlivspolitik" i dialogen åbner `public/privatliv.html` (dansk og engelsk på én side,
    for siden kører uden JavaScript og kender ikke appens sprog) fra web-buildet
    (`health_connect_privacy_policy_url` i `res/values/strings.xml` =
    `file:///android_asset/public/privatliv.html`).
  - **Kun debug** (`android/app/src/debug/`): `WRITE_STEPS`, så testere kan lægge skridt ind på
    emulatoren, og network-security-configen til dev-API'et. Release har kun `READ_STEPS`.
- **iOS:**
  - HealthKit-capability: `ios/App/App/App.entitlements` (`com.apple.developer.healthkit` = true,
    `com.apple.developer.healthkit.access` = tom), sat som `CODE_SIGN_ENTITLEMENTS` for Debug og
    Release i `App.xcodeproj`. En rigtig enhed kræver et team med HealthKit i provisioning-profilen.
  - `Info.plist`: `NSHealthShareUsageDescription` (engelsk; dansk i `da.lproj/InfoPlist.strings`,
    og `CFBundleLocalizations` = da, en, så også iOS' egne tekster i appen følger telefonens sprog).
    Kun læsning – der er ingen `NSHealthUpdateUsageDescription`, og pluginet virker uden.
  - HealthKit siger aldrig, om læsning er nægtet: efter dialogen er svaret altid "givet", og en
    nægtet læsning giver bare ingen data. Appen viser da "Ikke nok skridtdata endnu", ikke "ingen
    adgang". "Ingen adgang" kommer kun, når samtykket er aktivt, men appen aldrig har vist arket på
    telefonen (geninstalleret, ny telefon); knappen "Giv adgang" under rækken viser det.
- **Browser:** rækken vises ikke, og intet hentes.

### Testskridt og kørsel på emulatorerne

Brug en engangskonto (opret i appen, eller med curl: `POST /api/v1/auth/register` → linket fra
outboxen `docs/api-integration/docker/outbox/*.txt` med `curl` → log ind i appen). Kun hele dage
før i dag tæller, og der skal være skridt på mindst 7 af de seneste 28 dage.

**Android** (debug-build på `emulator-5554`, `adb` i `~/Library/Android/sdk/platform-tools`):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n dk.meploy.fitnessapp/.MainActivity
adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof dk.meploy.fitnessapp)
node scripts/android-webview-eval.mjs 'location.pathname'   # JavaScript i appens WebView (CDP)
```

1. Giv appen læse- og skriveadgang (kun debug kan skrive). Kaldet venter på dialogen, så resultatet
   gemmes på `window`, og dialogen godkendes med `uiautomator` + `input tap` (koordinaterne står i
   dumpet; første gang kommer "Get started" før dialogen, og "Allow all" + "Allow" godkender):

   ```bash
   node scripts/android-webview-eval.mjs 'Capacitor.Plugins.Health.requestAuthorization({ read: ["steps"], write: ["steps"] }).then(r => window.auth = r); "ok"'
   adb shell uiautomator dump /sdcard/ui.xml && adb shell cat /sdcard/ui.xml | grep -o 'text="[^"]*"[^>]*bounds="[^"]*"'
   adb shell input tap <x> <y>
   node scripts/android-webview-eval.mjs 'window.auth'
   ```

2. Læg én prøve pr. dag ind for de 10 dage før i dag (gennemsnit 8.300):

   ```bash
   node scripts/android-webview-eval.mjs '(async () => { const steps = [8000, 9000, 7000, 10000, 6000, 8500, 9500, 7500, 11000, 6500]; for (let i = 0; i < steps.length; i++) { const start = new Date(); start.setDate(start.getDate() - (i + 1)); start.setHours(10, 0, 0, 0); const end = new Date(start); end.setHours(11); await Capacitor.Plugins.Health.saveSample({ dataType: "steps", value: steps[i], startDate: start.toISOString(), endDate: end.toISOString() }); } return "seeded"; })()'
   ```

3. Log ind, Profil → Privatliv → slå "Skridt fra Health Connect" til. Har appen allerede
   læseadgang fra trin 1, kommer der ingen dialog. For at se den (og for 2.6-4a, når samtykket er
   givet) fjernes læseadgangen – det lukker appen, så start den igen bagefter:

   ```bash
   adb shell pm revoke dk.meploy.fitnessapp android.permission.health.READ_STEPS
   ```

   Kaldene ses som `CapacitorHttp fetch …` i WebView'ets konsol (`chrome://inspect`), ikke i logcat.

Tryk ikke på `KEYCODE_BACK` for at lukke tastaturet: tilbageknappen minimerer appen, og en app i
baggrunden må ikke åbne Health Connects dialog ("Background activity launch blocked").

**iOS** (simulatoren `Nutrify iPhone 17 Pro`): åbn Sundhed (`xcrun simctl launch <udid>
com.apple.Health`) → Oversigt → Skridt (eller Gennemse → Aktivitet → Skridt) → "+" (Tilføj data) →
Dato (kalenderen; forrige måned med "<"), Skridt → ✓. Gentag for mindst 7 forskellige dage før i
dag (fx 24.–30. sep. med 11.000, 5.000, 6.000, 10.000, 9.000, 8.000 og 7.000 = gennemsnit 8.000).
Appen styres med tryk i simulatoren; tekst sættes ind via simulatorens udklipsholder
(`xcrun simctl pbcopy <udid>`, tryk i feltet og vælg "Paste"/"Indsæt"). Første gang rækken slås til, viser iOS HealthKits ark
("Slå alle til" → "Tillad"). Adgangen fjernes igen i Indstillinger → Sundhed → Dataadgang og
enheder → Nutrify.

**Den månedlige grænse** gemmes på enheden under `nutrify.step-sync` =
`{ "syncedAt": "<ISO>", "dailySteps": 8300 }`. Sæt `syncedAt` 31 dage tilbage og genstart appen,
så synkroniseres der én gang ved start. Android: `localStorage.setItem(…)` via
`android-webview-eval.mjs`, **vent ~10 s** (WebView'et skriver `localStorage` til disk med
forsinkelse) og genstart med `adb shell am force-stop` + `am start`. iOS: luk appen
(`xcrun simctl terminate`), ret rækken i WebKits `localstorage.sqlite3` under
`$(xcrun simctl get_app_container <udid> dk.meploy.fitnessapp data)/Library/WebKit/…/LocalStorage/`
(tabellen `ItemTable`; værdien er en **UTF-16LE**-blob, fx med Pythons `sqlite3` og
`json.dumps(…).encode('utf-16-le')`), og start appen igen.

**Kendte begrænsninger i dev:** På Android-emulatoren vises dev-profilbilleder ikke: de serveres
over `http://10.0.2.2:5210`, og WebView'et (`https://localhost`) blokerer dem som mixed content –
også med `MIXED_CONTENT_ALWAYS_ALLOW` (afprøvet på WebView 124). iOS-simulatoren viser dem.
Produktion (HTTPS) er ikke berørt. Capacitors egen logning er slået fra – også i debug-builds –
med `loggingBehavior: 'none'` i `capacitor.config.ts`, fordi den skriver plugin-kaldenes data
(login, tokens, e-mail, skridt) i logcat og Xcode-konsollen. JavaScript-konsollen ses stadig i
WebView-inspektøren (`chrome://inspect`, Safari → Udvikler).

---

## Arbejdsgang

Web-koden bygges til `dist/mobilapp/browser` og kopieres ind i de native
projekter af Capacitor. Ændrer du web-kode, skal du køre:

```bash
npm run sync
```

`npm run sync` kører `ng build` efterfulgt af `cap sync`, som både kopierer
web-assets og opdaterer native plugins.

---

## Projektstruktur

```
mobilapp/
├── ARCHITECTURE.md         Bindende arkitektur- og kodregler
├── CLAUDE.md               Instruktion til AI-assistenter
├── capacitor.config.ts     Native konfiguration (app-id, webDir, plugins)
├── android/                Genereret Android-projekt
├── ios/                    Genereret Xcode-projekt (SPM)
├── public/                 Statiske filer, kopieres råt til build-output
└── src/
    ├── index.html
    ├── main.ts
    ├── styles.scss         Kun globale styles: tokens + reset + keyframes
    ├── styles/             Design tokens, reset, mixins, animationer
    ├── i18n/               da.json + en.json – alle tekster (ngx-translate)
    └── app/
        ├── app.ts          Rodkomponenten (kun en <router-outlet>)
        ├── app.routes.ts   Rod-routing; alle features lazy loades
        ├── app.config.ts   App-dækkende providers
        ├── core/           App-dækkende fundament (ingen afhængigheder opad)
        │   ├── constants/  APP_ROUTE, MEALS, STORAGE_KEY, DEFAULT_PROFILE …
        │   ├── models/     Profile, Food, Meal, Session, Tone …
        │   ├── services/   Storage, Theme, AuthApi, Session, FoodLog, WeightLog …
        │   ├── guards/     authGuard, guestGuard
        │   ├── interceptors/ authInterceptor (Bearer + token-fornyelse)
        │   ├── utils/      Dato- og talformatering, API-fejl og paginering, NOW-token
        │   └── testing/    Test-providers, fixtures og fake DOCUMENT
        ├── shared/
        │   └── components/ UiButton, UiSheet, UiRuler, Figure, FoodPicker,
        │                   BarcodeScanner, ProfileAvatar …
        └── features/       Én mappe pr. skærm/domæne, hver med sine routes
            ├── auth/       Login og glemt adgangskode
            ├── signup/     14-trins oprettelsesflow
            ├── shell/      Tab-rammen om de fem faner
            ├── home/       Hjem
            ├── food/       Mad
            ├── weight/     Vægt
            ├── collections/Samlinger og opskrifter
            ├── history/    Historik
            └── profile/    Profil
```

Hver mappe under `core/`, `shared/` og `features/` har sin egen `README.md`,
der forklarer indholdet. Se [`ARCHITECTURE.md`](ARCHITECTURE.md) for reglerne
om lagdeling og afhængighedsretning.

---

## Status

Nutrify-appen er implementeret efter designet: alle skærme fra
prototypen findes, og de er koblet sammen gennem `core/`.

- ✅ Angular 22 med strict TypeScript, zoneless change detection og
  signal-baserede standalone-komponenter
- ✅ Design tokens (lyst + mørkt tema) med systemets farvepalette; ingen
  hardcodede farver eller px-værdier i komponenter
- ✅ Capacitor 8 med native iOS- og Android-projekter
- ✅ Arkitekturregler dokumenteret i `ARCHITECTURE.md` og `CLAUDE.md`

### Skærme

| Feature       | Rute                           | Indhold                                                            |
| ------------- | ------------------------------ | ------------------------------------------------------------------ |
| `auth`        | `/login`, `/glemt-adgangskode` | Log ind med e-mail eller brugernavn og glemt adgangskode (link)    |
| `signup`      | `/opret`                       | 14-trins oprettelsesflow med figur-scener, linealer og opsummering |
| `shell`       | –                              | Tab-rammen om de fem faner; skjuler tab baren på fuldskærmsruter   |
| `home`        | `/hjem`                        | Ugeringe, dagens kort, gøremål, målkort og bekræftelses-ark        |
| `food`        | `/mad`                         | Dagens måltider, tilføj-ark, vare-søgning og stregkodescanner      |
| `weight`      | `/vaegt`                       | Vejning med lineal og vægt-scene, graf og vejningsliste            |
| `collections` | `/samling`                     | Samlinger, opskrifter (fuldskærm) og "Ny samling"-arket            |
| `history`     | `/historik`                    | Filtrerbar historik over vejninger, mad og måludskiftninger        |
| `profile`     | `/profil`                      | Profilbillede, plan, badges, tema, påmindelser og log ud           |

### Data og tilstand

**Appen indeholder ingen data.** Der er hverken varedatabase, retter, faste
samlinger, seedede logs eller demo-profil. **Konto og session** går mod FitnessApp-API'et:
oprettelse, e-mailbekræftelse via link (arket opdager det selv), login med e-mail eller brugernavn,
token-fornyelse, log ud, glemt adgangskode og slet konto. Tokens gemmes i `localStorage` (sikker
lagring er opgraderingsstien). `SessionDataService` henter hvert domænes data, når brugeren er
logget ind, og nulstiller dem ved log ud – domænerne kobles på én ad gangen.

Det, brugeren selv registrerer, gemmes lokalt gennem `StorageService`
(browserens `localStorage`): profil, madlog, egne varer, vejninger, egne samlinger,
tema, antal scanninger, påmindelser og opslåede stregkodevarer. Madloggen gemmes pr. dato
i 90 dage, så Hjems ugeringe, ugens nøgletal og Historik viser tidligere dage. Dage uden
data vises som `–` eller 0 i stedet for at gætte. Indtil et domæne er koblet på API'et, ligger
dets data kun lokalt.

### Test og build

```bash
npm run build          # produktionsbuild – skal være uden fejl og advarsler
npx ng test --watch=false
npx prettier --check src   # formatering; --write retter
```

Formateringen er **ikke** håndhævet automatisk: der findes hverken et
`format`-script, en pre-commit-hook eller CI, så `npx prettier --write src`
skal køres manuelt, før man committer. Se «Næste skridt».

`src/app/app-integration.spec.ts` dækker sammenkoblingen mellem features:
dybe links til Mad, tab barens synlighed, bekræftelses-arket på Hjem,
omdirigering efter log ud og temaskiftet. HTTP i specs går til Angulars testing-backend
(`HttpTestingController`) – se `src/app/core/testing/README.md`.
`src/capacitor-config.spec.ts` holder fast, at `capacitor.config.ts` slår Capacitors logning fra
og ikke injicerer `--safe-area-inset-*`.

### Næste skridt

- Kobl de øvrige domæner på API'et (profil, mål, vægt, madlog, samlinger, påmindelser)
  gennem `SessionDataService` – med loading- og fejltilstande på skærmene
- Produktions-URL for API'et og en CORS-politik i API'et (i dag omgået med dev-proxy og
  `CapacitorHttp`)
- App-ikoner og splash screens (`@capacitor/assets`)
- ESLint + Stylelint, så reglerne i `ARCHITECTURE.md` håndhæves automatisk
- `"format": "prettier --write src"` og `"format:check": "prettier --check src"`
  i `package.json` plus en pre-commit-hook eller et CI-trin, så formateringen
  ikke skrider igen
