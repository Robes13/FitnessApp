/**
 * The 30 collection icons from the design (`colIconDefs`). The API stores no icon, so every
 * collection shows `utensils`; the names stay because `IconName` is built from them.
 */
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
