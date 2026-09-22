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
(browserens `localStorage`): profil, dagens madlog, egne varer, vejninger,
egne samlinger, tema, antal scanninger og påmindelser. Madloggen er bundet til dagens dato
og starter tom hver dag; alt andet bliver liggende.

Appen kender derfor kun dagen i dag. Hjems ugeringe, ugens nøgletal og
badge-tællerne viser `–` eller 0 for alle dage uden data i stedet for at gætte,
og historikken rummer kun dagens måltider og brugerens vejninger. Når et API
kommer til, er det de steder, historikken skal ind.

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
