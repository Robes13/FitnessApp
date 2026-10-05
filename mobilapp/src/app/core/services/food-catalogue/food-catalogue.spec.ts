import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { FoodDto } from '../../models/food-api';
import { flushTestFoodLog, testFood, testFoodLog } from '../../testing/fixtures';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { BarcodeFlowService } from '../barcode-flow/barcode-flow';
import { FoodLogService } from '../food-log/food-log';
import { FoodSearchService } from '../food-search/food-search';
import { ProductLookupService } from '../product-lookup/product-lookup';
import { FoodCatalogueService } from './food-catalogue';

const COLA = testFood({
  foodId: 900,
  name: 'Coca-Cola',
  barcode: '5449000000996',
  caloriesPer100: 42,
  carbohydratesPer100: 10.6,
  createdByUserId: null,
  servings: [{ foodServingId: 9, unit: 'Milliliter', gramsPerUnit: 1 }],
});

describe('FoodCatalogueService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(): FoodCatalogueService {
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        { provide: FoodCatalogueService, useClass: FoodCatalogueService },
      ],
    });
    return TestBed.inject(FoodCatalogueService);
  }

  it('returns only the shared catalogue from a barcode search', async () => {
    const catalogue = setup();
    const done = firstValueFrom(catalogue.findByBarcode(COLA.barcode ?? ''));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/foods?barcode=5449000000996&limit=1')
      .flush({ items: [testFood({ foodId: 1, name: 'Min cola', barcode: COLA.barcode }), COLA] });

    await expect(done).resolves.toBe(COLA);
  });

  it('treats a failed search as nothing found', async () => {
    const catalogue = setup();
    const done = firstValueFrom(catalogue.search('cola', 6));
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/foods?query=cola&limit=6')
      .flush(null, { status: 500, statusText: 'Server Error' });

    await expect(done).resolves.toEqual([]);
  });
});

describe('the shared catalogue in the app', () => {
  let offLookups: string[];

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function setup(catalogue: readonly FoodDto[]): void {
    offLookups = [];
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        {
          provide: FoodCatalogueService,
          useValue: {
            findByBarcode: (barcode: string) =>
              of(catalogue.find((food) => food.barcode === barcode) ?? null),
            search: (query: string) =>
              of(catalogue.filter((food) => food.name.toLowerCase().includes(query.toLowerCase()))),
          },
        },
        {
          provide: ProductLookupService,
          useValue: {
            lookup: (barcode: string) => {
              offLookups.push(barcode);
              return of({ status: 'not-found', barcode });
            },
          },
        },
      ],
    });
  }

  it('the scanner answers from the catalogue before Open Food Facts', async () => {
    setup([COLA]);
    flushTestFoodLog();

    const result = await firstValueFrom(TestBed.inject(BarcodeFlowService).lookup('5449000000996'));

    expect(result).toMatchObject({
      status: 'found',
      product: { unit: 'ml', item: { id: '900', name: 'Coca-Cola', isCustom: false } },
    });
    expect(offLookups).toEqual([]);
  });

  it('logs a scanned catalogue product on the catalogue food, without a private copy', async () => {
    setup([COLA]);
    flushTestFoodLog();
    const foodLog = TestBed.inject(FoodLogService);
    const item = {
      id: 'off-5449000000996',
      name: 'Coca-Cola',
      quantity: '330 ml',
      kcal: 139,
      protein: 0,
      carbs: 35,
      fat: 0,
    };

    const done = firstValueFrom(foodLog.add(item, 'snack'));
    const log = TestBed.inject(HttpTestingController).expectOne({
      method: 'POST',
      url: '/api/v1/me/food-logs',
    });
    expect(log.request.body).toMatchObject({ foodId: 900, quantity: 330, unit: 'Milliliter' });
    log.flush(testFoodLog(item, 'snack', undefined, 900));

    await expect(done).resolves.toMatchObject({ id: '900', name: 'Coca-Cola' });
    expect(foodLog.foods()).toEqual([]);
    expect(offLookups).toEqual([]);
  });

  it('search lists own foods first, then catalogue foods with other names', async () => {
    setup([COLA, testFood({ foodId: 901, name: 'Cola Zero', createdByUserId: null })]);
    flushTestFoodLog([testFood({ foodId: 1, name: 'Coca-Cola' })]);
    const search = TestBed.inject(FoodSearchService);

    const results: string[][] = [];
    const done = new Promise<void>((resolve) =>
      search.search('cola').subscribe({
        next: (items) => results.push(items.map((food) => `${food.name}|${food.isCustom}`)),
        complete: resolve,
      }),
    );
    await done;

    expect(results).toEqual([['Coca-Cola|true'], ['Coca-Cola|true', 'Cola Zero|false']]);
  });
});
