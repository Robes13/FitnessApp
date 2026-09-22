import type { CapacitorConfig } from '@capacitor/cli';

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
  },
};

export default config;
