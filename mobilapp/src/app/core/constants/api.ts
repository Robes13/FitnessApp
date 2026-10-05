import { InjectionToken, isDevMode } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/** In the browser the API is called relative to the page; `ng serve` proxies `/api` (`proxy.conf.json`). */
const BROWSER_API_BASE_URL = '/api/v1';

/** The hosted API (Render, `render.yaml`) that production builds of the native apps call. */
const NATIVE_API_BASE_URL = 'https://nutrify-api.onrender.com/api/v1';

/**
 * The native apps have no dev proxy, so they call the API directly through CapacitorHttp. A
 * development build (`npm run sync:local`) calls the local API instead of the hosted one; the
 * Android emulator reaches the Mac's `localhost` as `10.0.2.2`, a physical device needs the
 * Mac's LAN IP.
 */
const NATIVE_DEV_API_BASE_URL: Readonly<Record<string, string>> = {
  android: 'http://10.0.2.2:5210/api/v1',
  ios: 'http://localhost:5210/api/v1',
};

/**
 * Base URL of the FitnessApp API, without a trailing slash. Endpoint constants are relative to
 * it (`'auth/login'`, `'me/weight-logs'`) – join them with `injectApiUrl()` from `utils/api.ts`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () =>
    !Capacitor.isNativePlatform()
      ? BROWSER_API_BASE_URL
      : isDevMode()
        ? (NATIVE_DEV_API_BASE_URL[Capacitor.getPlatform()] ?? BROWSER_API_BASE_URL)
        : NATIVE_API_BASE_URL,
});

/** Translation keys of the generic API errors (`toApiError()` in `utils/api.ts`). */
export const API_ERROR_MESSAGE_KEY = {
  /** Status 0: the request never reached the server (offline, DNS, CORS, timeout). */
  NETWORK: 'common.error.network',
  /** Status 5xx. */
  SERVER: 'common.error.server',
  /** Everything else no resolver knows. */
  REQUEST_FAILED: 'common.error.requestFailed',
} as const;
