/** Meal collection endpoints, relative to `API_BASE_URL`. */
export const COLLECTION_ENDPOINT = {
  COLLECTIONS: 'me/meal-collections',
  collection: (id: string): string => `me/meal-collections/${id}`,
  items: (id: string): string => `me/meal-collections/${id}/items`,
  item: (id: string, mealItemId: number): string => `me/meal-collections/${id}/items/${mealItemId}`,
  log: (id: string): string => `me/meal-collections/${id}/log`,
} as const;

/** The API's largest page (`limit`) of collections. */
export const COLLECTION_API_PAGE_LIMIT = 100;

/** The longest collection name the API accepts. */
export const COLLECTION_NAME_MAX_LENGTH = 100;

/** A collection holds 1–50 items – the API's rule (spec 4.0-8a: at least one). */
export const COLLECTION_MAX_ITEMS = 50;
