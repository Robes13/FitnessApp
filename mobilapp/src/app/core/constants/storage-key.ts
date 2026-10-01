/** Every key the app writes starts with this – `StorageService.clearAll()` removes them by it. */
export const STORAGE_KEY_PREFIX = 'nutrify.';

export const STORAGE_KEY = {
  SESSION: 'nutrify.session',
  THEME: 'nutrify.theme',
  LANGUAGE: 'nutrify.language',
  SCAN_COUNT: 'nutrify.scan-count',
  PRODUCT_CACHE: 'nutrify.product-cache',
  REMINDERS: 'nutrify.reminders',
  /**
   * The latest step sync (`StepSyncRecord`). On the device, not in the API, because the health
   * store is the device's: each device syncs its own steps once a month. An account's data like
   * the others, so another account signing in here starts without it.
   * ponytail: device-local, so a reinstall syncs again at once (harmless: same average); move
   * the date to a `UserSetting` in the API if syncs must ever be limited across devices.
   */
  STEP_SYNC: 'nutrify.step-sync',
} as const;

export type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY];

/**
 * Device settings rather than an account's data – kept when another account signs in here and
 * when the account is deleted.
 */
export const DEVICE_STORAGE_KEYS: readonly StorageKey[] = [STORAGE_KEY.THEME, STORAGE_KEY.LANGUAGE];
