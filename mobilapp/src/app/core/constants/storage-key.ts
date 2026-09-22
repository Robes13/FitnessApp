export const STORAGE_KEY = {
  SESSION: 'nutrify.session',
  PROFILE: 'nutrify.profile',
  FOOD_LOG: 'nutrify.food-log',
  CUSTOM_FOODS: 'nutrify.custom-foods',
  WEIGHT_LOG: 'nutrify.weight-log',
  COLLECTIONS: 'nutrify.collections',
  THEME: 'nutrify.theme',
  SCAN_COUNT: 'nutrify.scan-count',
  REMINDERS: 'nutrify.reminders',
} as const;

export type StorageKey = (typeof STORAGE_KEY)[keyof typeof STORAGE_KEY];
