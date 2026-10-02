import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { BARCODE_PLUGIN_ERROR } from '../../constants/barcode';
import { STORAGE_KEY } from '../../constants/storage-key';
import { BarcodeScannerPlatform, CameraPermission } from '../../models/barcode';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { BARCODE_SCANNER_PLATFORM, BarcodeScannerService } from './barcode-scanner';

const EAN_13 = '5701234567890';

class FakeScannerPlatform implements BarcodeScannerPlatform {
  available = true;
  needsPermission = false;
  permission: CameraPermission = 'granted';
  permissionAfterRequest: CameraPermission = 'granted';
  moduleAvailable = true;
  installError: Error | null = null;
  scanned: readonly string[] | Error = [EAN_13];
  readonly calls: string[] = [];

  isAvailable(): boolean {
    return this.available;
  }
  requiresCameraPermission(): boolean {
    return this.needsPermission;
  }
  async checkCameraPermission(): Promise<CameraPermission> {
    return this.permission;
  }
  async requestCameraPermission(): Promise<CameraPermission> {
    this.calls.push('request');
    return this.permissionAfterRequest;
  }
  async isScannerModuleAvailable(): Promise<boolean> {
    return this.moduleAvailable;
  }
  async installScannerModule(): Promise<void> {
    this.calls.push('install');
    if (this.installError) {
      throw this.installError;
    }
  }
  async scan(): Promise<readonly string[]> {
    this.calls.push('scan');
    if (this.scanned instanceof Error) {
      throw this.scanned;
    }
    return this.scanned;
  }
  async openSettings(): Promise<void> {
    this.calls.push('settings');
  }
}

describe('BarcodeScannerService', () => {
  let storage: FakeStorage;
  let platform: FakeScannerPlatform;

  function setup(): BarcodeScannerService {
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        { provide: BARCODE_SCANNER_PLATFORM, useValue: platform },
      ],
    });
    return TestBed.inject(BarcodeScannerService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
    platform = new FakeScannerPlatform();
  });

  it('returns the scanned barcode', async () => {
    await expect(setup().scan()).resolves.toEqual({ status: 'scanned', barcode: EAN_13 });
  });

  it('is unavailable in the browser and never touches the plugin', async () => {
    platform.available = false;
    const scanner = setup();

    expect(scanner.canScan).toBe(false);
    await expect(scanner.scan()).resolves.toEqual({ status: 'unavailable' });
    expect(platform.calls).toEqual([]);
  });

  it('asks for camera permission where needed and reports a refusal', async () => {
    platform.needsPermission = true;
    platform.permission = 'prompt';
    platform.permissionAfterRequest = 'denied';

    await expect(setup().scan()).resolves.toEqual({ status: 'permission-denied' });
    expect(platform.calls).toEqual(['request']);
  });

  it('does not ask again when the permission is already denied', async () => {
    platform.needsPermission = true;
    platform.permission = 'denied';

    await expect(setup().scan()).resolves.toEqual({ status: 'permission-denied' });
    expect(platform.calls).toEqual([]);
  });

  it('scans after the permission is granted', async () => {
    platform.needsPermission = true;
    platform.permission = 'prompt';

    await expect(setup().scan()).resolves.toEqual({ status: 'scanned', barcode: EAN_13 });
    expect(platform.calls).toEqual(['request', 'scan']);
  });

  it('starts installing the Google barcode module once, then says it is unavailable', async () => {
    platform.moduleAvailable = false;
    const scanner = setup();

    await expect(scanner.scan()).resolves.toEqual({ status: 'module-installing' });
    // A failed or stalled download never reports back – asking again would repeat "try again".
    await expect(scanner.scan()).resolves.toEqual({ status: 'module-unavailable' });
    expect(platform.calls).toEqual(['install']);

    platform.moduleAvailable = true;
    await expect(scanner.scan()).resolves.toEqual({ status: 'scanned', barcode: EAN_13 });
  });

  it('says the module is unavailable when Google refuses to install it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    platform.moduleAvailable = false;
    platform.installError = new Error('API unavailable');

    await expect(setup().scan()).resolves.toEqual({ status: 'module-unavailable' });
  });

  it('maps the plugin errors to cancelled / permission-denied / unreadable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const scanner = setup();

    platform.scanned = new Error(BARCODE_PLUGIN_ERROR.CANCELED);
    await expect(scanner.scan()).resolves.toEqual({ status: 'cancelled' });

    platform.scanned = new Error(BARCODE_PLUGIN_ERROR.PERMISSION_DENIED);
    await expect(scanner.scan()).resolves.toEqual({ status: 'permission-denied' });

    platform.scanned = new Error('The scan failed.');
    await expect(scanner.scan()).resolves.toEqual({ status: 'unreadable' });
  });

  it('is unreadable when no valid barcode came back', async () => {
    platform.scanned = ['https://example.com', '123'];

    await expect(setup().scan()).resolves.toEqual({ status: 'unreadable' });
  });

  it('opens the settings through the plugin', async () => {
    await setup().openSettings();

    expect(platform.calls).toEqual(['settings']);
  });

  it('counts and persists the scans, continuing the count stored when it loads', async () => {
    storage.setItem(STORAGE_KEY.SCAN_COUNT, '1');
    const scanner = setup();
    // Read on `load()` (the session is authenticated), not at construction.
    expect(scanner.scanCount()).toBe(0);
    await firstValueFrom(scanner.load());

    scanner.recordScan();
    scanner.recordScan();

    expect(scanner.scanCount()).toBe(3);
    expect(storage.getItem(STORAGE_KEY.SCAN_COUNT)).toBe('3');
  });

  it('forgets the count in memory on reset and leaves the stored one alone', async () => {
    storage.setItem(STORAGE_KEY.SCAN_COUNT, '6');
    const scanner = setup();
    await firstValueFrom(scanner.load());

    scanner.reset();

    expect(scanner.scanCount()).toBe(0);
    expect(storage.getItem(STORAGE_KEY.SCAN_COUNT)).toBe('6');
  });
});
