export const COLLECTION_ICON_NAMES = [
  'egg',
  'bolt',
  'utensils',
  'cookie',
  'coffee',
  'salad',
  'fish',
  'flame',
  'leaf',
  'heart',
  'star',
  'dumbbell',
  'apple',
  'carrot',
  'sprout',
  'soup',
  'pizza',
  'icecream',
  'cake',
  'sandwich',
  'milk',
  'droplet',
  'timer',
  'sun',
  'moon',
  'target',
  'trophy',
  'bike',
  'bag',
  'sparkles',
] as const;

export type CollectionIconName = (typeof COLLECTION_ICON_NAMES)[number];

/** Antal ikoner der vises, før brugeren trykker "Vis flere". */
export const COLLECTION_ICON_PREVIEW_COUNT = 12;
