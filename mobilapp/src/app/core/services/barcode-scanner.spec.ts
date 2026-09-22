import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { STORAGE_KEY } from '../constants/storage-key';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { BarcodeScannerService } from './barcode-scanner';

describe('BarcodeScannerService', () => {
  let storage: FakeStorage;

  function setup(): BarcodeScannerService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(BarcodeScannerService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('reports an unknown product, since there is nothing to look up in', async () => {
    const scanner = setup();

    await expect(firstValueFrom(scanner.scan())).resolves.toEqual({ status: 'unknown' });
    await expect(firstValueFrom(scanner.scan())).resolves.toEqual({ status: 'unknown' });
  });

  it('counts and persists the scans', async () => {
    const scanner = setup();

    await firstValueFrom(scanner.scan());
    await firstValueFrom(scanner.scan());
    await firstValueFrom(scanner.scan());

    expect(scanner.scanCount()).toBe(3);
    expect(storage.getItem(STORAGE_KEY.SCAN_COUNT)).toBe('3');
  });

  it('continues the persisted count', async () => {
    storage.setItem(STORAGE_KEY.SCAN_COUNT, '1');
    const scanner = setup();

    expect(scanner.scanCount()).toBe(1);
    await firstValueFrom(scanner.scan());
    expect(scanner.scanCount()).toBe(2);
  });
});
