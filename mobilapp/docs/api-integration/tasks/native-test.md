# Opgave: fuld test på Android-emulator og iOS-simulator

Self-contained instructions (English) for the native UI testers. The browser test
(`tasks/ui-test.md`, all passed after 3 fix rounds) is the baseline: run the SAME steps 2–18 on a
real native build, plus the health steps H1–H6 below, and look for everything that differs on a
device. Do not modify repo files – report defects.

## Devices and builds

- Android: emulator `Nutrify_API_35` = `emulator-5554` (Android 15, Health Connect built in). adb:
  `~/Library/Android/sdk/platform-tools/adb`. App id `dk.meploy.fitnessapp`.
- iOS: simulator `Nutrify iPhone 17 Pro`, UDID `ADDBF0BD-E86B-40F6-BF57-41D4257C3670` (iOS 26.5).
  Drive it with `mcp__Claude_Code_iOS_Simulator__control` (screenshot, tap, swipe, text, button,
  open_url; load with ToolSearch if deferred) and `xcrun simctl`.
- The builds are made for you before each test round (the orchestrator/merge step runs
  `npm run build`, `npx cap sync`, `./gradlew assembleDebug`, `xcodebuild`). You only install and
  launch the artefacts named in your prompt. **Never** run `npm run build`, `npx cap sync`, gradle
  or xcodebuild yourself – the other platform's tester shares the working tree.
- How to drive each platform (CDP on Android, taps on iOS, seeding steps, native dialogs): see
  "Native test" in `mobilapp/README.md` and the how-to-drive notes in your prompt.
- Android WebView DOM: forward the WebView devtools socket and use Chrome DevTools Protocol
  (`Runtime.evaluate`) with a small node script (Node 24 has a global `WebSocket`) to read the page
  text, fill inputs (dispatch `input` events), click, and read `localStorage`. Native screens
  (Health Connect dialog, notification permission, photo picker, share/download) need
  `adb shell uiautomator dump` + `adb shell input tap/text`. Screenshots: `adb exec-out screencap -p`
  → look at them (Read the PNG).
- iOS has no DOM access: use screenshots + taps + `text`. To edit the app's localStorage (e.g. the
  last step-sync time) terminate the app (`xcrun simctl terminate`), find the WebKit LocalStorage
  SQLite file under `xcrun simctl get_app_container <udid> dk.meploy.fitnessapp data`
  (Library/WebKit/WebsiteData/…/LocalStorage), edit it with `sqlite3`, relaunch.

## Shared API – rules (both platforms test at the same time)

- The Docker API at `http://localhost:5210` is shared. **Never** `docker restart`/`stop` it and
  never `compose down`. Lockout (step 5) is lifted by a password reset (step 7 proves that) – use a
  dedicated account for the lockout check.
- "API down" error states: Android → `adb shell cmd connectivity airplane-mode enable` (and
  `disable` afterwards); iOS → not possible per simulator; mark those sub-steps "covered in the
  browser test + Android".
- Mail links: read the outbox (`mobilapp/docs/api-integration/docker/outbox/*.txt`, filter on
  `To: <email>`). Open verification links with `curl -s '<link>'` on the host (the page was tested
  in the browser; the point here is that the APP reacts). Reset form: `curl -s -X POST -d
  token=…&newPassword=…&newPasswordConfirmation=… <base>/api/v1/auth/password/reset`. Also try once
  to open a link from the device (iOS: `open_url`, Android: `adb shell am start -a
  android.intent.action.VIEW -d <link>`) – the link host is `localhost:5210`, which a device cannot
  reach on Android (10.0.2.2) – report what happens as a finding about `App:PublicBaseUrl` on devices.
- Accounts: prefix usernames with `ia` (iOS) / `an` (Android) + random, e-mails
  `ia+<random>@example.test` / `an+<random>@example.test`. Keep them in
  `<scratch>/native-accounts-<platform>.json`; never print passwords.

## Steps

Run `tasks/ui-test.md` steps 2–18 (skip step 1 setup; apply the rules above for steps 5, 11 and
13), and on top check what is native-specific in each:

- Safe areas / notch / status bar / home indicator, the tab bar, nothing cut off, portrait lock,
  large system font (iOS: Settings → Accessibility → Display & Text Size, try one larger size once;
  Android: `adb shell settings put system font_scale 1.3`, reset to 1.0 afterwards).
- Keyboard: inputs stay visible above the keyboard (login, signup, food search, sheets).
- Android hardware back: closes sheets first, then goes back, never exits from a sheet.
- App resume: background the app and return (iOS: `button HOME` then relaunch; Android:
  `adb shell input keyevent KEYCODE_HOME` then `am start`) – the verification modal re-checks
  (1.1), refresh on open (1.5), data still shown.
- CapacitorHttp: every API call works natively (no CORS), error texts are the same as in the
  browser (problem bodies arrive as strings on Android).
- 2.4 photo: the native picker (iOS simulator has sample photos; Android: push a JPEG with
  `adb push` to `/sdcard/Pictures/` and `adb shell am broadcast -a
  android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/<file>`), camera where
  offered, crop, upload, the avatar loads from the dev-image URL on the device.
- 3.1 barcode: what the scanner offers on a device (camera / manual entry); test what is possible on
  an emulator and say what is not.
- 8.0-4a: the real notification permission prompt (allow and deny paths), reminders scheduled.
- 9.1 export: what happens on the device (system browser / download / share sheet).

Health (new, spec 2.6 + 9.2-3a), on both platforms:

- **H1** Seed step data for at least 7 of the last 30 days (Android: debug WRITE_STEPS +
  `saveSample` via CDP; iOS: Health app → Browse → Activity → Steps → Add Data, different dates).
- **H2** Profile → privacy section shows the steps row only on the device (not in the browser).
  Turn it on → the native permission dialog (Health Connect / HealthKit) → allow →
  `POST me/consents` 201 → `PUT me/profile/activity` with the 30-day average (check the number
  against your seeded data) → activity level and kcal target on Profile/Home change; status text
  shows the date and value.
- **H3** 4a: on a fresh account deny the permission → stays off / "no access" message, activity
  unchanged. 3a: an account whose device has < 7 days of data (Android: delete seeded data in
  Health Connect settings or use fewer days; iOS: delete samples in Health) → "not enough data",
  unchanged. 3b: make the read fail (Android: revoke the permission in Health Connect settings
  while the consent stays on, or airplane mode for the API part) → "could not fetch" message, and
  the next app open tries again.
- **H4** Monthly trigger: set the stored last-sync time to 31 days ago (Android: CDP on
  localStorage; iOS: sqlite as above), relaunch → exactly one new sync; relaunch again → no sync.
- **H5** 9.2-3a: turn the row off → confirmation explains activity must be updated manually →
  `POST me/consents/StepsIntegration/withdraw` 204 → relaunch → no sync; the activity level can be
  edited manually (2.5) and stays.
- **H6** History/log hygiene: no tokens, passwords or e-mails in `docker logs fitnessapp-dev-api-1`
  or the device logs (`adb logcat -d | grep -i …`, iOS `xcrun simctl spawn <udid> log show --last 10m
  --predicate 'process == "App"'`).

## Report

Per step: pass / fail / blocked (with why), defects with platform (`android` / `ios` / `both`),
area, expected vs actual, evidence (screenshot observations, CDP output, logs), and spec gaps.
