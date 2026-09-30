import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { BarcodeFlowService } from './barcode-flow';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner';
import { ProductLookupService } from '../product-lookup/product-lookup';

const JUICE: ScannedProduct = {
  barcode: '5701234567890',
  unit: 'ml',
  item: {
    id: 'off-5701234567890',
    name: 'Appelsinjuice',
    quantity: '100 ml',
    kcal: 45,
    protein: 1,
    carbs: 10,
    fat: 0,
  },
  servingGrams: null,
};

describe('BarcodeFlowService', () => {
  function setup(): BarcodeFlowService {
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        {
          provide: ProductLookupService,
          useValue: {
            lookup: (): ReturnType<ProductLookupService['lookup']> =>
              of<ProductLookupResult>({ status: 'found', product: JUICE }),
          },
        },
      ],
    });
    return TestBed.inject(BarcodeFlowService);
  }

  it('counts one scan per lookup, when it is subscribed', async () => {
    const flow = setup();
    const scanner = TestBed.inject(BarcodeScannerService);

    const lookup = flow.lookup(JUICE.barcode);
    expect(scanner.scanCount()).toBe(0);

    await expect(firstValueFrom(lookup)).resolves.toEqual({ status: 'found', product: JUICE });
    expect(scanner.scanCount()).toBe(1);
  });

  it('scales a product in its own unit', () => {
    expect(setup().scale(JUICE, 250)).toEqual({
      ...JUICE.item,
      quantity: '250 ml',
      kcal: 113,
      protein: 3,
      carbs: 25,
      fat: 0,
    });
  });
});
