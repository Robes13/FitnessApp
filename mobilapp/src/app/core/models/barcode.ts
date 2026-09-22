import { PRODUCT_BASE_UNIT } from '../constants/barcode';
import { FoodItem } from './food';

/** `'g'`, or `'ml'` for liquids. */
export type ProductBaseUnit = (typeof PRODUCT_BASE_UNIT)[keyof typeof PRODUCT_BASE_UNIT];

/**
 * How a camera scan ended.
 * - `scanned`: a valid barcode (8–14 digits) was read.
 * - `cancelled`: the user closed the camera.
 * - `permission-denied`: no camera access (iOS).
 * - `unreadable`: the camera returned no usable barcode, or the scan failed.
 * - `module-installing`: Android's Google barcode module is missing; its download was started.
 * - `unavailable`: no camera scanning on this platform (the browser).
 */
export type BarcodeScanOutcome =
  | { readonly status: 'scanned'; readonly barcode: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'permission-denied' }
  | { readonly status: 'unreadable' }
  | { readonly status: 'module-installing' }
  | { readonly status: 'unavailable' };

/** Camera permission as the platform reports it. */
export type CameraPermission =
  'granted' | 'limited' | 'denied' | 'prompt' | 'prompt-with-rationale';

/**
 * The native barcode scanner behind an interface, so `BarcodeScannerService` can be tested
 * without Capacitor. See `BARCODE_SCANNER_PLATFORM`.
 */
export interface BarcodeScannerPlatform {
  /** `false` in the browser or when the native plugin is missing. */
  isAvailable(): boolean;
  /** Whether the ready-made scan UI needs the camera permission (iOS yes, Android no). */
  requiresCameraPermission(): boolean;
  checkCameraPermission(): Promise<CameraPermission>;
  requestCameraPermission(): Promise<CameraPermission>;
  /** Android's Google barcode module. Always `true` where it isn't needed. */
  isScannerModuleAvailable(): Promise<boolean>;
  /** Starts the module's download; it finishes in the background. */
  installScannerModule(): Promise<void>;
  /** Opens the camera UI and resolves with the raw values of the detected barcodes. */
  scan(): Promise<readonly string[]>;
  openSettings(): Promise<void>;
}

/**
 * A product looked up by barcode. `item`'s macros apply to `PRODUCT_BASE_GRAMS` of `unit`
 * (100 g, or 100 ml for liquids).
 */
export interface ScannedProduct {
  readonly barcode: string;
  readonly item: FoodItem;
  readonly unit: ProductBaseUnit;
  /** The package's serving size in grams, when Open Food Facts gives it in grams. */
  readonly servingGrams: number | null;
}

/** The result of `ProductLookupService.lookup()`. Network errors are a result, not a throw. */
export type ProductLookupResult =
  | { readonly status: 'found'; readonly product: ScannedProduct }
  | { readonly status: 'not-found'; readonly barcode: string }
  | { readonly status: 'error'; readonly barcode: string };
