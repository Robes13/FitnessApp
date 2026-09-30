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
  android: {
    backgroundColor: '#F8FAFC',
    // Angular 22 targets "baseline widely available", whose Chrome floor is 119.
    // The production bundle is not transpiled below that (e.g. Object.hasOwn,
    // optional chaining), so an older System WebView renders a blank screen and
    // runs unpatched Chromium with native bridge access. 119 is also the last
    // WebView release available to Android 7 (minSdkVersion 24) devices.
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
    Keyboard: {
      // WebView'et ændrer ikke størrelse; appen krymper sin egen rod med --keyboard-inset.
      resize: KeyboardResize.None,
    },
  },
};

export default config;
