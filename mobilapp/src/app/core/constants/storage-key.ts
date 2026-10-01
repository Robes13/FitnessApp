/** Every key the app writes starts with this – `StorageService.clearAll()` removes them by it. */
export const STORAGE_KEY_PREFIX = 'nutrify.';

export const STORAGE_KEY = {
  SESSION: 'nutrify.session',
  THEME: 'nutrify.theme',
  LANGUAGE: 'nutrify.language',
  SCAN_COUNT: 'nutrify.scan-count',
  PRODUCT_CACHE: 'nutrify.product-cache',
  REMINDERS: 'nutrify.reminders',
} as const;

export type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY];

/**
 * Device settings rather than an account's data – kept when another account signs in here and
 * when the account is deleted.
 */
export const DEVICE_STORAGE_KEYS: readonly StorageKey[] = [STORAGE_KEY.THEME, STORAGE_KEY.LANGUAGE];
