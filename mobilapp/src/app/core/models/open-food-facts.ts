/**
 * Open Food Facts' API v2 response for `/api/v2/product/{code}.json` (only the requested
 * `fields`). Backend model – `ProductLookupService` maps it to `ScannedProduct`.
 * Numbers occasionally arrive as strings, hence `number | string`.
 */
export interface OpenFoodFactsNutriments {
  readonly 'energy-kcal_100g'?: number | string;
  /** Energy in kJ – used when `energy-kcal_100g` is missing. */
  readonly 'energy-kj_100g'?: number | string;
  /** Energy in kJ (Open Food Facts' default energy unit). Last fallback. */
  readonly energy_100g?: number | string;
  readonly proteins_100g?: number | string;
  readonly carbohydrates_100g?: number | string;
  readonly fat_100g?: number | string;
}

export interface OpenFoodFactsProduct {
  readonly product_name?: string;
  readonly product_name_da?: string;
  /** Comma-separated, e.g. `'Arla, Arla Foods'`. */
  readonly brands?: string;
  readonly nutriments?: OpenFoodFactsNutriments;
  /** Free text, e.g. `'30 g'` or `'1 bar (40 g)'`. */
  readonly serving_size?: string;
  /** Package size, e.g. `'500 g'` or `'1,5 l'`. A unit in ml/cl/l marks a liquid. */
  readonly quantity?: string;
  /** What the nutrition values are per: `'100g'`, `'100ml'` or `'serving'`. */
  readonly nutrition_data_per?: string;
}

export interface OpenFoodFactsProductResponse {
  readonly code?: string;
  /** `1` = found, `0` = unknown product. */
  readonly status: number;
  readonly status_verbose?: string;
  readonly product?: OpenFoodFactsProduct;
}
