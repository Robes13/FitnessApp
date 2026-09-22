import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SCANNED_DEMO_ITEM } from '../constants/demo-data';
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

  it('alternates between a found item and an unknown product', async () => {
    const scanner = setup();

    await expect(firstValueFrom(scanner.scan())).resolves.toEqual({
      status: 'found',
      item: SCANNED_DEMO_ITEM,
    });
    await expect(firstValueFrom(scanner.scan())).resolves.toEqual({ status: 'unknown' });
    await expect(firstValueFrom(scanner.scan())).resolves.toMatchObject({ status: 'found' });
    expect(scanner.scanCount()).toBe(3);
    expect(storage.getItem(STORAGE_KEY.SCAN_COUNT)).toBe('3');
  });

  it('continues the persisted count', async () => {
    storage.setItem(STORAGE_KEY.SCAN_COUNT, '1');
    const scanner = setup();

    expect(scanner.scanCount()).toBe(1);
    await expect(firstValueFrom(scanner.scan())).resolves.toEqual({ status: 'unknown' });
  });
});
