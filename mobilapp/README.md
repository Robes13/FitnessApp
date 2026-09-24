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

Appen kører nu på <http://localhost:4200>.

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
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted dk.meploy.fitnessapp
```

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
    └── app/
        ├── app.ts          Rodkomponenten (kun en <router-outlet>)
        ├── app.routes.ts   Rod-routing; alle features lazy loades
        ├── app.config.ts   App-dækkende providers
        ├── core/           App-dækkende fundament (ingen afhængigheder opad)
        │   ├── constants/  APP_ROUTE, MEALS, STORAGE_KEY, DEFAULT_PROFILE …
        │   ├── models/     Profile, Food, Meal, Session, Tone …
        │   ├── services/   Storage, Theme, AuthApi, Session, FoodLog, WeightLog …
        │   ├── guards/     authGuard, guestGuard
        │   ├── utils/      Dato- og talformatering, NOW-token
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
| `auth`        | `/login`, `/glemt-adgangskode` | Log ind og nulstil adgangskode i tre trin                          |
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
samlinger, seedede logs eller demo-profil, og `AuthApi` har endnu ingen
backend at kalde – hvert auth-kald fejler med "Der er ingen forbindelse til en
server endnu." Login og oprettelse virker derfor først, når backenden findes.

Det, brugeren selv registrerer, gemmes lokalt gennem `StorageService`
(browserens `localStorage`): profil, madlog, egne varer, vejninger, egne samlinger,
tema, antal scanninger, påmindelser og opslåede stregkodevarer. Madloggen gemmes pr. dato
i 90 dage, så Hjems ugeringe, ugens nøgletal og Historik viser tidligere dage. Dage uden
data vises som `–` eller 0 i stedet for at gætte. Når et API kommer til, skal de lokale
stores synkroniseres med det.

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
omdirigering efter log ud og temaskiftet.

### Næste skridt

- Rigtig backend: HTTP-lag (`provideHttpClient` + interceptor), base-URL i en
  miljøkonfiguration, token i sessionen og en implementering af `AuthApi`
- Data fra backenden: varedatabase, retter, faste samlinger og historik – samt
  loading- og fejltilstande på de skærme, der i dag kun kender tom/udfyldt
- App-ikoner og splash screens (`@capacitor/assets`)
- ESLint + Stylelint, så reglerne i `ARCHITECTURE.md` håndhæves automatisk
- `"format": "prettier --write src"` og `"format:check": "prettier --check src"`
  i `package.json` plus en pre-commit-hook eller et CI-trin, så formateringen
  ikke skrider igen
