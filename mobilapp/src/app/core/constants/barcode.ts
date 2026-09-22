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

/** User-facing texts of the scanner (Danish). */
export const BARCODE_SCANNER_TEXT = {
  HINT_IDLE_NATIVE: 'Tryk på "Scan stregkode" og hold kameraet over stregkoden',
  HINT_IDLE_WEB: 'Kameraet er kun tilgængeligt i appen. Indtast stregkodens tal i stedet.',
  HINT_SCANNING: 'Læser stregkode…',
  HINT_LOOKING_UP: 'Slår varen op…',
  PERMISSION_DENIED:
    'Appen har ikke adgang til kameraet. Giv adgang under Indstillinger for at scanne stregkoder – eller indtast tallene herunder.',
  UNREADABLE:
    'Vi kunne ikke læse stregkoden. Prøv igen med bedre lys, eller indtast tallene herunder.',
  MODULE_INSTALLING: 'Stregkodescanneren hentes fra Google Play. Prøv igen om et øjeblik.',
  LOOKUP_ERROR: 'Vi kunne ikke slå varen op. Tjek din internetforbindelse, og prøv igen.',
  INVALID_BARCODE: `Stregkoden skal være ${BARCODE_MIN_DIGITS}–${BARCODE_MAX_DIGITS} cifre.`,
  INVALID_AMOUNT: `Angiv en mængde mellem ${SCAN_AMOUNT_MIN_GRAMS} og ${SCAN_AMOUNT_MAX_GRAMS} g.`,
  DUPLICATE_NAME: 'Du har allerede en egen vare med det navn.',
  SERVING_LABEL: 'Portion',
  AMOUNT_LABEL: (unit: string): string => `Mængde (${unit})`,
  AMOUNT_ARIA_LABEL: (unit: string): string =>
    `Mængde i ${unit === PRODUCT_BASE_UNIT.MILLILITRES ? 'milliliter' : 'gram'}`,
  BARCODE_LABEL_NATIVE: 'Eller indtast stregkoden',
  BARCODE_LABEL_WEB: 'Indtast stregkoden',
  /** Name of a product Open Food Facts has no name for. */
  UNNAMED_PRODUCT: (barcode: string): string => `Vare ${barcode}`,
} as const;
