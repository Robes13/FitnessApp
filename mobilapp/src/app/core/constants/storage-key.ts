export const STORAGE_KEY = {
  SESSION: 'nutrify.session',
  PROFILE: 'nutrify.profile',
  FOOD_LOG: 'nutrify.food-log',
  CUSTOM_FOODS: 'nutrify.custom-foods',
  WEIGHT_LOG: 'nutrify.weight-log',
  COLLECTIONS: 'nutrify.collections',
  THEME: 'nutrify.theme',
  LANGUAGE: 'nutrify.language',
  SCAN_COUNT: 'nutrify.scan-count',
  PRODUCT_CACHE: 'nutrify.product-cache',
  REMINDERS: 'nutrify.reminders',
} as const;

export type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY];
