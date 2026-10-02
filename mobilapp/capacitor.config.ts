import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

/**
 * Capacitor configuration.
 *
 * `webDir` peger på Angulars build-output, så de native skaller altid
 * pakker den bundle, `npm run build` producerer.
 */
const config: CapacitorConfig = {
  appId: 'dk.meploy.fitnessapp',
  appName: 'Nutrify',
  webDir: 'dist/mobilapp/browser',
  // Capacitor's bridge logs every plugin call and result with its data (login bodies, tokens,
  // step counts) to logcat / the Xcode console – by default ('debug') in every debug build.
  // No sensitive data in device logs (kravspec); the WebView inspector still shows the console.
  loggingBehavior: 'none',
  android: {
    backgroundColor: '#F8FAFC',
    // Angular 22 targets "baseline widely available", whose Chrome floor is 119.
    // The production bundle is not transpiled below that (e.g. Object.hasOwn,
    // optional chaining), so an older System WebView renders a blank screen and
    // runs unpatched Chromium with native bridge access. (minSdkVersion is 26,
    // Android 8 – Health Connect's minimum.)
    minWebViewVersion: 119,
  },
  server: {
    // Static page (public/) that Capacitor loads instead of the app when the
    // WebView is older than minWebViewVersion.
    errorPath: 'webview-error.html',
  },
  ios: {
    backgroundColor: '#F8FAFC',
    contentInset: 'never',
    // Tastaturet må ikke skubbe WebView'et: layoutet gør selv plads (se KeyboardService).
    scrollEnabled: false,
  },
  plugins: {
    // Routes fetch/XHR through the native HTTP stack, so the WebView's CORS rules don't apply –
    // the API has no CORS policy. Only absolute URLs go native (see `API_BASE_URL`).
    CapacitorHttp: {
      enabled: true,
    },
    Keyboard: {
      // WebView'et ændrer ikke størrelse; appen krymper sin egen rod med --keyboard-inset.
      resize: KeyboardResize.None,
    },
    SystemBars: {
      // Android: the app reads env(safe-area-inset-*), so it doesn't need the --safe-area-inset-*
      // variables 'css' injects (whose first injection runs before the page exists and errors).
      insetsHandling: 'native',
    },
  },
};

export default config;
