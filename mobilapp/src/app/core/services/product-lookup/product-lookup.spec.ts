import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  OPEN_FOOD_FACTS,
  PRODUCT_LOOKUP_TIMEOUT_MS,
  openFoodFactsProductUrl,
} from '../../constants/barcode';
import { STORAGE_KEY } from '../../constants/storage-key';
import { ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { OpenFoodFactsProductResponse } from '../../models/open-food-facts';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { ProductLookupService, toScannedProduct } from './product-lookup';

const BARCODE = '5701234567890';
const REQUEST_URL = `${openFoodFactsProductUrl(BARCODE)}?fields=${OPEN_FOOD_FACTS.FIELDS}`;

const FOUND_RESPONSE: OpenFoodFactsProductResponse = {
  code: BARCODE,
  status: 1,
  product: {
    product_name: 'Skyr Natural',
    product_name_da: 'Skyr naturel',
    brands: 'Arla, Arla Foods',
    serving_size: '1 bæger (150 g)',
    nutriments: {
      'energy-kcal_100g': 63.4,
      proteins_100g: 11,
      carbohydrates_100g: '3.84',
      fat_100g: 0.2,
    },
  },
};

const EXPECTED_PRODUCT: ScannedProduct = {
  barcode: BARCODE,
  unit: 'g',
  item: {
    id: `off-${BARCODE}`,
    name: 'Skyr naturel',
    brand: 'Arla',
    quantity: '100 g',
    kcal: 63,
    protein: 11,
    carbs: 3.8,
    fat: 0.2,
  },
  servingGrams: 150,
};

describe('ProductLookupService', () => {
  let storage: FakeStorage;
  let http: HttpTestingController;
  let service: ProductLookupService;

  beforeEach(() => {
    storage = createFakeStorage();
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ProductLookupService);
  });

  afterEach(() => {
    http.verify();
  });

  function lookup(): Promise<ProductLookupResult> {
    return firstValueFrom(service.lookup(BARCODE));
  }

  it('maps a found product to 100 g and caches it', async () => {
    const result = lookup();
    http.expectOne(REQUEST_URL).flush(FOUND_RESPONSE);

    await expect(result).resolves.toEqual({ status: 'found', product: EXPECTED_PRODUCT });
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PRODUCT_CACHE) ?? '{}')).toEqual({
      [BARCODE]: EXPECTED_PRODUCT,
    });
  });

  it('answers a repeated lookup from the cache without a request (offline)', async () => {
    const first = lookup();
    http.expectOne(REQUEST_URL).flush(FOUND_RESPONSE);
    await first;

    await expect(lookup()).resolves.toEqual({ status: 'found', product: EXPECTED_PRODUCT });
    http.expectNone(REQUEST_URL);
  });

  it('is not-found for status 0 and for HTTP 404', async () => {
    const byStatus = lookup();
    http.expectOne(REQUEST_URL).flush({ status: 0, status_verbose: 'product not found' });
    await expect(byStatus).resolves.toEqual({ status: 'not-found', barcode: BARCODE });

    const by404 = lookup();
    http.expectOne(REQUEST_URL).flush({ status: 0 }, { status: 404, statusText: 'Not Found' });
    await expect(by404).resolves.toEqual({ status: 'not-found', barcode: BARCODE });
    expect(storage.getItem(STORAGE_KEY.PRODUCT_CACHE)).toBeNull();
  });

  it('is not-found when the product has no kcal', async () => {
    const result = lookup();
    http.expectOne(REQUEST_URL).flush({
      status: 1,
      product: { product_name: 'Vand', nutriments: { proteins_100g: 0 } },
    });

    await expect(result).resolves.toEqual({ status: 'not-found', barcode: BARCODE });
  });

  it('drops malformed cache entries and looks them up again', async () => {
    storage.setItem(
      STORAGE_KEY.PRODUCT_CACHE,
      JSON.stringify({
        [BARCODE]: { barcode: BARCODE, item: { name: 'Uden kcal' }, servingGrams: null },
        '12345678': 'not a product',
      }),
    );

    const result = lookup();
    http.expectOne(REQUEST_URL).flush(FOUND_RESPONSE);

    await expect(result).resolves.toEqual({ status: 'found', product: EXPECTED_PRODUCT });
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PRODUCT_CACHE) ?? '{}')).toEqual({
      [BARCODE]: EXPECTED_PRODUCT,
    });
  });

  it('reads a cached product from before liquids had a unit as grams (offline)', async () => {
    const { unit: _unit, ...legacy } = EXPECTED_PRODUCT;
    storage.setItem(STORAGE_KEY.PRODUCT_CACHE, JSON.stringify({ [BARCODE]: legacy }));

    await expect(lookup()).resolves.toEqual({ status: 'found', product: EXPECTED_PRODUCT });
    http.expectNone(REQUEST_URL);
  });

  it('ignores a cache that is not an object', async () => {
    storage.setItem(STORAGE_KEY.PRODUCT_CACHE, JSON.stringify([EXPECTED_PRODUCT]));

    const result = lookup();
    http.expectOne(REQUEST_URL).flush(FOUND_RESPONSE);

    await expect(result).resolves.toEqual({ status: 'found', product: EXPECTED_PRODUCT });
  });

  it('is an error on network failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = lookup();
    http.expectOne(REQUEST_URL).error(new ProgressEvent('error'));

    await expect(result).resolves.toEqual({ status: 'error', barcode: BARCODE });
  });

  it('is an error when the request times out', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = lookup();
    const request = http.expectOne(REQUEST_URL);

    vi.advanceTimersByTime(PRODUCT_LOOKUP_TIMEOUT_MS);

    await expect(result).resolves.toEqual({ status: 'error', barcode: BARCODE });
    expect(request.cancelled).toBe(true);
    vi.useRealTimers();
  });
});

describe('toScannedProduct', () => {
  it('falls back to the English name, then to the barcode, and skips a missing brand', () => {
    expect(
      toScannedProduct(BARCODE, { product_name: 'Oats', nutriments: { 'energy-kcal_100g': 370 } })
        ?.item.name,
    ).toBe('Oats');

    const unnamed = toScannedProduct(BARCODE, { nutriments: { 'energy-kcal_100g': 370 } });
    expect(unnamed?.item.name).toBe(`Vare ${BARCODE}`);
    expect(unnamed?.item).not.toHaveProperty('brand');
    expect(unnamed?.servingGrams).toBeNull();
  });

  it('only reads a serving size given in grams', () => {
    const product = (serving: string): ScannedProduct | null =>
      toScannedProduct(BARCODE, { serving_size: serving, nutriments: { 'energy-kcal_100g': 40 } });

    expect(product('30 g')?.servingGrams).toBe(30);
    expect(product('12,5g')?.servingGrams).toBe(13);
    expect(product('250 ml')?.servingGrams).toBeNull();
  });

  it('falls back to kJ when kcal is missing', () => {
    expect(toScannedProduct(BARCODE, { nutriments: { 'energy-kj_100g': 418.4 } })?.item.kcal).toBe(
      100,
    );
    expect(toScannedProduct(BARCODE, { nutriments: { energy_100g: '837' } })?.item.kcal).toBe(200);
    expect(
      toScannedProduct(BARCODE, {
        nutriments: { 'energy-kcal_100g': 50, 'energy-kj_100g': 1000 },
      })?.item.kcal,
    ).toBe(50);
  });

  it('labels liquids per 100 ml', () => {
    const quantity = (product: Parameters<typeof toScannedProduct>[1]): string | undefined =>
      toScannedProduct(BARCODE, { ...product, nutriments: { 'energy-kcal_100g': 42 } })?.item
        .quantity;

    expect(quantity({ nutrition_data_per: '100ml' })).toBe('100 ml');
    expect(
      toScannedProduct(BARCODE, { quantity: '1 l', nutriments: { 'energy-kcal_100g': 42 } })?.unit,
    ).toBe('ml');
    expect(quantity({ quantity: '1,5 L' })).toBe('100 ml');
    expect(quantity({ quantity: '33 cl' })).toBe('100 ml');
    expect(quantity({ quantity: '500 g', nutrition_data_per: '100g' })).toBe('100 g');
    expect(quantity({})).toBe('100 g');
  });

  it('rejects negative nutrition values', () => {
    expect(toScannedProduct(BARCODE, { nutriments: { 'energy-kcal_100g': -5 } })).toBeNull();
  });
});
