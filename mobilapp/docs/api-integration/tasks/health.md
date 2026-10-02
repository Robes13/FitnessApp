# Opgave: skridt fra Apple Sundhed / Health Connect (spec 2.6 og 9.2-3a) + native dev-opsætning

Self-contained task text (English) for the implementation agent. Binding: `plan-v2.md` (rules §0,
contract §3, contracts between stores §4.3), `kravspec.md` (2.6, 9.2), `mobilapp/ARCHITECTURE.md`,
`mobilapp/CLAUDE.md`, and the READMEs of every folder you touch. Ponytail: simplest correct
solution, reuse what exists, no dependency beyond the ONE plugin below.

## Context

- Repo `/Users/janick/Documents/GitHub/FitnessApp`, branch `feat/api-integration`, work directly in
  the main tree (no other agent works in it now). Commit at the end (Conventional Commits in
  Danish, NO Co-Authored-By or AI attribution, never push). An untracked `.claude/` at the repo
  root is expected — leave it.
- The API needs **no change**: it already has `ConsentType.StepsIntegration` (3),
  `POST /api/v1/me/consents { consentType: "StepsIntegration", documentVersion: "1" }` → 201 (409
  when already active), `POST /api/v1/me/consents/StepsIntegration/withdraw` → 204 (404 when none
  is active; does NOT delete the account – only Terms/HealthDataProcessing do),
  `GET /api/v1/me/consents?limit=50` → `CursorPage<UserConsentDto>` (`withdrawnAt` null = active),
  and `PUT /api/v1/me/profile/activity { dailySteps: int, fromHealthIntegration: true }` →
  200 `UserProfileDto` (403 without an active StepsIntegration consent; recalculates the goal).
  Read `API/Controllers/ConsentsController.cs`, `ProfileController.cs`,
  `Services/Consent/ConsentService.cs`, `Services/Profiles/UserProfileService.cs` to confirm.
- Docker API: `http://localhost:5210` (compose `mobilapp/docs/api-integration/docker/compose.yml`).
- Native toolchain: `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`,
  Android SDK `~/Library/Android/sdk` (adb in `platform-tools`), Xcode 26.5. A dedicated Android
  emulator `Nutrify_API_35` (Android 15, Health Connect built in) is running as `emulator-5554`, and
  a dedicated iOS simulator `Nutrify iPhone 17 Pro` (UDID `ADDBF0BD-E86B-40F6-BF57-41D4257C3670`,
  iOS 26.5) is booted. Use only these two devices.

## What to build

1. **Plugin.** `npm install @capgo/capacitor-health` (v8, supports HealthKit + Health Connect, SPM)
   in `mobilapp`, then `npm run build && npx cap sync`. Read its README/types in
   `node_modules/@capgo/capacitor-health` (isAvailable, requestAuthorization, checkAuthorization,
   queryAggregated with `bucket: 'day'`, saveSample, openHealthConnectSettings, showPrivacyPolicy).
   Wrap it in ONE thin core service (so specs can stub it) – never call the plugin from components.

2. **StepSyncService** in `core/services/step-sync/` (a `SessionDataStore`, registered in
   `SESSION_DATA_STORES`; never injects `SessionService`; `reset()` clears memory only):
   - `available`: native platform and `isAvailable()` true (web → false; the UI hides the feature).
   - `enabled`: an active StepsIntegration consent, read in `load()` from `GET me/consents`.
   - `load()`: read the consent, then `syncIfDue()`. Never errors (status signal like the other
     stores).
   - **2.6 monthly trigger:** due when enabled, available and the last successful sync is ≥ 30 days
     ago or never. Store the last sync time locally (new `STORAGE_KEY`, it is per device because the
     health store is per device; `// ponytail:` note). Checked whenever the session's stores load
     (app start / login) – no scheduler.
   - **sync:** `checkAuthorization` for reading steps → not granted = 2.6-4a (no data, activity
     unchanged, status `no-permission`). Otherwise `queryAggregated` steps, day buckets, the last 30
     full local days; average over the days that have steps; fewer than 7 such days = 2.6-3a
     (`insufficient`, unchanged). Else `PUT me/profile/activity { dailySteps: round(avg),
     fromHealthIntegration: true }`, then let `UserProfileService` reflect the new steps and the
     recalculated goal (reuse `reloadGoal()` / the existing profile mapping – check the contract in
     plan-v2 §4.3), save the sync time, status `synced` with the new value. A plugin/API failure =
     2.6-3b: status `failed`, the sync time is NOT saved (retried next time), and the user is told.
   - **enable()** (user turns it on): `requestAuthorization({ read: ['steps'] })` → if granted,
     `POST me/consents` (409 = already active = fine) → sync now. Denied → stays off, message.
   - **disable()** = 9.2-3a: `POST me/consents/StepsIntegration/withdraw` (404 = already gone =
     fine) → enabled false → no more syncing; the activity level stays and is edited manually (2.5).
   - Pessimistic state, errors through `toApiError()` / i18n keys.

3. **UI** (feature profile, privacy/consent section that already lists the Terms row): a row
   "Skridt fra Apple Sundhed" (iOS) / "Skridt fra Health Connect" (Android), only when `available`,
   with an on/off control (reuse `UiSwitch`/`UiRowButton`/`UiSheet`/the confirm sheet that exist),
   a short explanation, and the latest status ("Hentet d. … – 7.432 skridt om dagen",
   "Ikke nok skridtdata endnu", "Nutrify har ikke adgang til dine skridt – giv adgang i …",
   "Vi kunne ikke hente dine skridt. Vi prøver igen næste gang"). Turning it off asks for
   confirmation (9.2 step 4) and says that activity must now be updated manually. The 3b message must
   also reach a user who doesn't open Profile – use the smallest existing surface (e.g. the Home
   todo/notice pattern if one exists), otherwise a profile-only status is acceptable; say which you
   chose. Every text in BOTH `src/i18n/da.json` and `en.json` (proper æ/ø/å). Design tokens, BEM,
   OnPush, signals, no `any`, no magic strings.

4. **Native config.**
   - iOS: HealthKit capability (an `App.entitlements` with `com.apple.developer.healthkit` true and
     `com.apple.developer.healthkit.access` empty, wired via `CODE_SIGN_ENTITLEMENTS` for Debug and
     Release in `ios/App/App.xcodeproj/project.pbxproj`), `NSHealthShareUsageDescription` in
     `Info.plist` (Danish, like the existing camera text). Read access only – do not add
     `NSHealthUpdateUsageDescription` unless the plugin crashes without it.
     App Transport Security: allow the dev API on `http://localhost:5210` (prefer
     `NSAllowsLocalNetworking`; verify CapacitorHttp really reaches it).
   - Android: raise `minSdkVersion` to 26 (Health Connect's minimum; note it in the README).
     Keep only `android.permission.health.READ_STEPS` in the release manifest (remove the plugin's
     other health permissions with `tools:node="remove"`); check the merged manifest
     (`android/app/build/intermediates/merged_manifest/...`). Health Connect only shows its
     permission dialog when the app declares the permissions-rationale / privacy-policy entry points
     – make sure the plugin's or the app's manifest has them (Android 14+: activity-alias with
     `android.intent.action.VIEW_PERMISSION_USAGE` + category `android.intent.category.HEALTH_PERMISSIONS`;
     older: `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE`) and that the privacy policy shows a
     real page: add a short Danish privacy page `public/privatliv.html` (served by Capacitor from
     the web dir; how Nutrify uses step data: only the 30-day average is sent to Nutrify's server to
     compute the activity level, nothing is written) and point the plugin to it per its README.
     **Debug-only** (`android/app/src/debug/`): `WRITE_STEPS` (so testers can seed steps on the
     emulator with `saveSample`), and a network security config that allows cleartext only to
     `10.0.2.2` and `localhost` (the dev API). Release must stay cleartext-free.
   - Dev profile images: in Development the API returns a relative `profileImageUrl`
     (`/api/v1/dev-images/…`). On native that resolves against the WebView origin and breaks.
     Resolve relative image URLs against the API origin (`API_BASE_URL`) in the existing profile
     mapping – one place.

5. **Tests and docs.** vitest specs for StepSyncService (due/not due, 4a, 3a, 3b keeps the old sync
   time, success PUTs the rounded average and reloads the goal, enable 409 = ok, disable 404 = ok,
   web = unavailable, reset) with the plugin wrapper stubbed and `HttpTestingController.verify()`;
   specs for the new profile row; the relative image URL. Update READMEs (core/services,
   features/profile, native setup in `mobilapp/README.md` incl. how to seed test steps on both
   emulators – see below). `cd mobilapp && npx ng test --watch=false && npx ng build` clean.

6. **Native build check (must pass before you finish).**
   - Android: `cd mobilapp && npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)`
     → install on `emulator-5554` (`adb install -r app/build/outputs/apk/debug/app-debug.apk`),
     launch, confirm the login screen renders and `POST auth/login` reaches the Docker API (e.g. log
     in with a wrong password and see the neutral error, or check `docker logs fitnessapp-dev-api-1`).
   - iOS: `npx cap sync ios`, build for the simulator with `xcodebuild` (scheme `App`, the SPM
     project in `ios/App`, destination `id=ADDBF0BD-E86B-40F6-BF57-41D4257C3670`, derived data in a
     scratch dir), `xcrun simctl install` + `launch` (bundle `dk.meploy.fitnessapp`), confirm the
     login screen and that the API is reachable. You may use `mcp__Claude_Code_iOS_Simulator__control`
     (screenshot/tap) — load it with ToolSearch if deferred.
   - Then a quick health smoke test on BOTH: seed ≥ 7 days of steps (Android: debug build, run
     `Capacitor.Plugins.Health.requestAuthorization({read:['steps'],write:['steps']})` +
     `saveSample` per day from the WebView via Chrome DevTools Protocol — `adb forward tcp:9222
     localabstract:webview_devtools_remote_<pid>` and a tiny node script using Node's global
     `WebSocket` + `Runtime.evaluate`; approve the Health Connect dialog with `adb shell uiautomator
     dump` + `adb shell input tap`. iOS: add step samples in the simulator's Health app, Browse →
     Activity → Steps → Add Data, with different dates), sign up a throwaway account on the device
     (or log in with one created by curl: register → verify link from the outbox → login), enable
     the row, accept the native permission dialog, and confirm `PUT me/profile/activity` sends the
     average and the activity/kcal on Profile changes; then disable it and confirm the withdraw call.
     Document exactly how you seeded data and drove each device in `mobilapp/README.md` (the next
     testers reuse it).

Report: files changed, decisions, test counts, native build/smoke results per platform (with
evidence), anything that did not work and why.
