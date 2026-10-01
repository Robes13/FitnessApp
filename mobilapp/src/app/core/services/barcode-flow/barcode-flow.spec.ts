import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { flushTestFoodLog, testFood } from '../../testing/fixtures';
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
  /** Barcodes asked of Open Food Facts. */
  let offLookups: string[];

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(): BarcodeFlowService {
    offLookups = [];
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        {
          provide: ProductLookupService,
          useValue: {
            lookup: (barcode: string): ReturnType<ProductLookupService['lookup']> => {
              offLookups.push(barcode);
              return of<ProductLookupResult>({ status: 'found', product: JUICE });
            },
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

  it('answers from the user own catalogue before Open Food Facts (3.1-6a)', async () => {
    const flow = setup();
    flushTestFoodLog([
      testFood({
        foodId: 3,
        name: 'Min juice',
        barcode: JUICE.barcode,
        caloriesPer100: 42.5,
        carbohydratesPer100: 10.6,
        servings: [{ foodServingId: 1, unit: 'Milliliter', gramsPerUnit: 1 }],
      }),
      testFood({
        foodId: 4,
        name: 'Ukendt bar',
        barcode: '5799999999991',
        caloriesPer100: 180,
        servings: [{ foodServingId: 2, unit: 'Piece', gramsPerUnit: 100 }],
      }),
    ]);

    await expect(firstValueFrom(flow.lookup(JUICE.barcode))).resolves.toEqual({
      status: 'found',
      product: {
        barcode: JUICE.barcode,
        unit: 'ml',
        item: {
          id: '3',
          name: 'Min juice',
          quantity: '100 ml',
          kcal: 42.5,
          protein: 0,
          carbs: 10.6,
          fat: 0,
          isCustom: true,
        },
        servingGrams: null,
      },
    });
    const bar = await firstValueFrom(flow.lookup('5799999999991'));
    expect(bar.status === 'found' && bar.product).toMatchObject({ unit: 'g', servingGrams: 100 });
    expect(offLookups).toEqual([]);

    await firstValueFrom(flow.lookup('4000000000000'));
    expect(offLookups).toEqual(['4000000000000']);
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
