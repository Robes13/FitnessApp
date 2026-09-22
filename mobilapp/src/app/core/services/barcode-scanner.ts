import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { BARCODE_PATTERN, BARCODE_PLUGIN_ERROR } from '../constants/barcode';
import { STORAGE_KEY } from '../constants/storage-key';
import { BarcodeScanOutcome, BarcodeScannerPlatform, CameraPermission } from '../models/barcode';
import { StorageService } from './storage';

/** The plugin's name in the native bridge (`Capacitor.isPluginAvailable`). */
const PLUGIN_NAME = 'BarcodeScanner';
const PLATFORM_IOS = 'ios';
const PLATFORM_ANDROID = 'android';

/** Grocery barcodes only – fewer formats make the scanner faster and avoid QR false hits. */
const GROCERY_FORMATS: BarcodeFormat[] = [
  BarcodeFormat.Ean13,
  BarcodeFormat.Ean8,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
];

/**
 * `@capacitor-mlkit/barcode-scanning` via its ready-made `scan()` UI. On Android that is
 * Google's code scanner (Play Services) – it needs the Google barcode module but no camera
 * permission. On iOS the plugin's own camera view needs the camera permission.
 */
export class CapacitorBarcodeScannerPlatform implements BarcodeScannerPlatform {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME);
  }

  requiresCameraPermission(): boolean {
    return Capacitor.getPlatform() === PLATFORM_IOS;
  }

  async checkCameraPermission(): Promise<CameraPermission> {
    return (await BarcodeScanner.checkPermissions()).camera;
  }

  async requestCameraPermission(): Promise<CameraPermission> {
    return (await BarcodeScanner.requestPermissions()).camera;
  }

  async isScannerModuleAvailable(): Promise<boolean> {
    if (Capacitor.getPlatform() !== PLATFORM_ANDROID) {
      return true;
    }
    return (await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available;
  }

  async installScannerModule(): Promise<void> {
    await BarcodeScanner.installGoogleBarcodeScannerModule();
  }

  async scan(): Promise<readonly string[]> {
    const { barcodes } = await BarcodeScanner.scan({ formats: GROCERY_FORMATS });
    return barcodes.flatMap((barcode) => (barcode.rawValue ? [barcode.rawValue] : []));
  }

  async openSettings(): Promise<void> {
    await BarcodeScanner.openSettings();
  }
}

/** The platform's barcode scanner. Specs provide a fake. */
export const BARCODE_SCANNER_PLATFORM = new InjectionToken<BarcodeScannerPlatform>(
  'BARCODE_SCANNER_PLATFORM',
  { providedIn: 'root', factory: () => new CapacitorBarcodeScannerPlatform() },
);

const GRANTED_PERMISSIONS: readonly CameraPermission[] = ['granted', 'limited'];
const PROMPT_PERMISSIONS: readonly CameraPermission[] = ['prompt', 'prompt-with-rationale'];

/**
 * Barcode scanning with the camera, plus the scan counter behind the "10 scans" badge.
 *
 * All plugin calls go through `BARCODE_SCANNER_PLATFORM`. `scan()` never throws: every way a
 * scan can end is a `BarcodeScanOutcome`, so the UI can show the right state.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private readonly storage = inject(StorageService);
  private readonly platform = inject(BARCODE_SCANNER_PLATFORM);
  private readonly scanCountState = signal<number>(
    this.storage.read<number>(STORAGE_KEY.SCAN_COUNT) ?? 0,
  );

  readonly scanCount: Signal<number> = this.scanCountState.asReadonly();
  /** `false` in the browser: the UI offers typing the barcode instead. */
  readonly canScan: boolean = this.platform.isAvailable();

  async scan(): Promise<BarcodeScanOutcome> {
    if (!this.canScan) {
      return { status: 'unavailable' };
    }
    try {
      if (!(await this.hasCameraAccess())) {
        return { status: 'permission-denied' };
      }
      if (!(await this.platform.isScannerModuleAvailable())) {
        await this.platform.installScannerModule();
        return { status: 'module-installing' };
      }
      const barcode = (await this.platform.scan()).find((value) => BARCODE_PATTERN.test(value));
      return barcode ? { status: 'scanned', barcode } : { status: 'unreadable' };
    } catch (error: unknown) {
      return this.toFailedOutcome(error);
    }
  }

  /** Opens the app's system settings, so the user can grant camera access. */
  async openSettings(): Promise<void> {
    try {
      await this.platform.openSettings();
    } catch (error: unknown) {
      console.warn('BarcodeScannerService kunne ikke åbne indstillingerne.', error);
    }
  }

  /** Counts one barcode lookup (scanned or typed) and persists the count. */
  recordScan(): void {
    const count = this.scanCountState() + 1;
    this.scanCountState.set(count);
    this.storage.write(STORAGE_KEY.SCAN_COUNT, count);
  }

  private async hasCameraAccess(): Promise<boolean> {
    if (!this.platform.requiresCameraPermission()) {
      return true;
    }
    let permission = await this.platform.checkCameraPermission();
    if (PROMPT_PERMISSIONS.includes(permission)) {
      permission = await this.platform.requestCameraPermission();
    }
    return GRANTED_PERMISSIONS.includes(permission);
  }

  private toFailedOutcome(error: unknown): BarcodeScanOutcome {
    const message = error instanceof Error ? error.message : String(error);
    if (message === BARCODE_PLUGIN_ERROR.CANCELED) {
      return { status: 'cancelled' };
    }
    if (message === BARCODE_PLUGIN_ERROR.PERMISSION_DENIED) {
      return { status: 'permission-denied' };
    }
    console.warn('BarcodeScannerService: scanningen fejlede.', error);
    return { status: 'unreadable' };
  }
}
