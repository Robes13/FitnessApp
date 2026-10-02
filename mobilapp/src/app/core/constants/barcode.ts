/** Shortest and longest barcode the app accepts (EAN-8 … GTIN-14). */
export const BARCODE_MIN_DIGITS = 8;
export const BARCODE_MAX_DIGITS = 14;

/** A barcode is 8–14 digits and nothing else. */
export const BARCODE_PATTERN = new RegExp(`^\\d{${BARCODE_MIN_DIGITS},${BARCODE_MAX_DIGITS}}$`);

/** Open Food Facts' product endpoint (API v2) and the fields the app reads. */
export const OPEN_FOOD_FACTS = {
  PRODUCT_URL: 'https://world.openfoodfacts.org/api/v2/product',
  FIELDS: 'product_name,product_name_da,brands,nutriments,serving_size,quantity,nutrition_data_per',
  /** `status` in the response when the product exists. */
  STATUS_FOUND: 1,
  /** `nutrition_data_per` when the nutrition values are per 100 ml (a liquid). */
  NUTRITION_PER_100_ML: '100ml',
} as const;

/** Kilojoules per kilocalorie – for products that only give energy in kJ. */
export const KJ_PER_KCAL = 4.184;

/** Unit of a looked-up item's base portion: grams, or millilitres for liquids. */
export const PRODUCT_BASE_UNIT = {
  GRAMS: 'g',
  MILLILITRES: 'ml',
} as const;

/** `https://world.openfoodfacts.org/api/v2/product/{code}.json`. */
export function openFoodFactsProductUrl(barcode: string): string {
  return `${OPEN_FOOD_FACTS.PRODUCT_URL}/${barcode}.json`;
}

/** How long a product lookup may take before it counts as a network error. */
export const PRODUCT_LOOKUP_TIMEOUT_MS = 8000;

/**
 * Open Food Facts' nutrition values are per 100 g (or 100 ml for liquids); the looked-up
 * item's base portion.
 */
export const PRODUCT_BASE_GRAMS = 100;

/** Prefix for ids of items looked up by barcode: `off-<barcode>`. */
export const PRODUCT_ID_PREFIX = 'off';

/** Max number of looked-up products kept in the local cache (oldest are dropped first). */
export const PRODUCT_CACHE_LIMIT = 100;

/** Amount the user may log from a scanned product, in grams. */
export const SCAN_AMOUNT_MIN_GRAMS = 1;
export const SCAN_AMOUNT_MAX_GRAMS = 5000;

/** Quick picks for the amount of a scanned product, in grams. */
export const SCAN_AMOUNT_PRESETS_GRAMS: readonly number[] = [50, 100, 200];

/** Error messages the native plugin (`@capacitor-mlkit/barcode-scanning`) rejects with. */
export const BARCODE_PLUGIN_ERROR = {
  CANCELED: 'scan canceled.',
  PERMISSION_DENIED: 'User denied access to camera.',
} as const;

/** Translation keys of the scanner's user-facing texts. */
export const BARCODE_SCANNER_TEXT_KEY = {
  HINT_IDLE_NATIVE: 'core.barcode.hintIdleNative',
  HINT_IDLE_WEB: 'core.barcode.hintIdleWeb',
  HINT_SCANNING: 'core.barcode.hintScanning',
  HINT_LOOKING_UP: 'core.barcode.hintLookingUp',
  PERMISSION_DENIED: 'core.barcode.permissionDenied',
  UNREADABLE: 'core.barcode.unreadable',
  MODULE_INSTALLING: 'core.barcode.moduleInstalling',
  MODULE_UNAVAILABLE: 'core.barcode.moduleUnavailable',
  LOOKUP_ERROR: 'core.barcode.lookupError',
  /** Params: `BARCODE_SCANNER_TEXT_PARAMS.INVALID_BARCODE`. */
  INVALID_BARCODE: 'core.barcode.invalidBarcode',
  /** Params: `BARCODE_SCANNER_TEXT_PARAMS.INVALID_AMOUNT` and the item's `unit` (g or ml). */
  INVALID_AMOUNT: 'core.barcode.invalidAmount',
  SERVING_LABEL: 'core.barcode.servingLabel',
  /** Params: `unit`. */
  AMOUNT_LABEL: 'core.barcode.amountLabel',
  AMOUNT_ARIA_LABEL_MILLILITRES: 'core.barcode.amountAriaLabelMillilitres',
  AMOUNT_ARIA_LABEL_GRAMS: 'core.barcode.amountAriaLabelGrams',
  BARCODE_LABEL_NATIVE: 'core.barcode.barcodeLabelNative',
  BARCODE_LABEL_WEB: 'core.barcode.barcodeLabelWeb',
  /** Name of a product Open Food Facts has no name for. Params: `barcode`. */
  UNNAMED_PRODUCT: 'core.barcode.unnamedProduct',
} as const;

/** The fixed params of the scanner's validation messages. */
export const BARCODE_SCANNER_TEXT_PARAMS = {
  INVALID_BARCODE: { minDigits: BARCODE_MIN_DIGITS, maxDigits: BARCODE_MAX_DIGITS },
  INVALID_AMOUNT: { minGrams: SCAN_AMOUNT_MIN_GRAMS, maxGrams: SCAN_AMOUNT_MAX_GRAMS },
} as const;

/** Translation key of the amount field's accessible name for the item's base unit. */
export function amountAriaLabelKey(unit: string): string {
  return unit === PRODUCT_BASE_UNIT.MILLILITRES
    ? BARCODE_SCANNER_TEXT_KEY.AMOUNT_ARIA_LABEL_MILLILITRES
    : BARCODE_SCANNER_TEXT_KEY.AMOUNT_ARIA_LABEL_GRAMS;
}
