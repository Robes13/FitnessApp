import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { STORAGE_KEY } from '../../constants/storage-key';
import { ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { createFakeStorage } from '../../testing/fake-document';
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
        ...provideCoreTestEnvironment({
          storage: createFakeStorage({
            [STORAGE_KEY.CUSTOM_FOODS]: [
              {
                id: 'food-1',
                name: 'Proteinbar',
                quantity: '1 stk',
                kcal: 200,
                protein: 20,
                carbs: 0,
                fat: 0,
                isCustom: true,
              },
            ],
          }),
        }),
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

  it('checks custom food names trimmed and case-insensitively', () => {
    const flow = setup();

    expect(flow.isCustomFoodNameTaken('  proteinbar ')).toBe(true);
    expect(flow.isCustomFoodNameTaken('Skyr')).toBe(false);
    expect(flow.isCustomFoodNameTaken('   ')).toBe(false);
  });

  it('builds the custom food from the "Unknown item" form', () => {
    const food = setup().toCustomFood({
      name: ' Rugbrød ',
      quantity: '',
      kcal: 99.6,
      protein: null,
    });

    expect(food).toEqual({
      id: expect.stringMatching(/^food-/),
      name: 'Rugbrød',
      quantity: '1 portion',
      kcal: 100,
      protein: 0,
      carbs: 0,
      fat: 0,
      isCustom: true,
    });
  });
});
