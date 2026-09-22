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

/** Number of icons shown before the user taps "Show more". */
export const COLLECTION_ICON_PREVIEW_COUNT = 12;

/**
 * What the icon depicts, read aloud by screen readers. The design only has the
 * drawings (`colIconDefs`), so the names are translated here alongside
 * `COLLECTION_ICON_NAMES`, so any icon picker can use the same Danish names.
 */
export const COLLECTION_ICON_LABELS: Readonly<Record<CollectionIconName, string>> = {
  egg: 'Æg',
  bolt: 'Lyn',
  utensils: 'Bestik',
  cookie: 'Småkage',
  coffee: 'Kaffe',
  salad: 'Salat',
  fish: 'Fisk',
  flame: 'Flamme',
  leaf: 'Blad',
  heart: 'Hjerte',
  star: 'Stjerne',
  dumbbell: 'Håndvægt',
  apple: 'Æble',
  carrot: 'Gulerod',
  sprout: 'Spire',
  soup: 'Suppe',
  pizza: 'Pizza',
  icecream: 'Is',
  cake: 'Kage',
  sandwich: 'Sandwich',
  milk: 'Mælk',
  droplet: 'Dråbe',
  timer: 'Timer',
  sun: 'Sol',
  moon: 'Måne',
  target: 'Mål',
  trophy: 'Pokal',
  bike: 'Cykel',
  bag: 'Taske',
  sparkles: 'Glimt',
};
