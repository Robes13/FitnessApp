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
  appName: 'Mobilapp',
  webDir: 'dist/mobilapp/browser',
  android: {
    backgroundColor: '#F8FAFC',
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
