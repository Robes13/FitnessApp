import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, tap, timeout } from 'rxjs';
import {
  BARCODE_SCANNER_TEXT_KEY,
  KJ_PER_KCAL,
  OPEN_FOOD_FACTS,
  PRODUCT_BASE_GRAMS,
  PRODUCT_BASE_UNIT,
  PRODUCT_CACHE_LIMIT,
  PRODUCT_ID_PREFIX,
  PRODUCT_LOOKUP_TIMEOUT_MS,
  openFoodFactsProductUrl,
} from '../../constants/barcode';
import { STORAGE_KEY } from '../../constants/storage-key';
import { ProductBaseUnit, ProductLookupResult, ScannedProduct } from '../../models/barcode';
import {
  OpenFoodFactsNutriments,
  OpenFoodFactsProduct,
  OpenFoodFactsProductResponse,
} from '../../models/open-food-facts';
import { Translate, injectTranslate } from '../language/translate';
import { StorageService } from '../storage/storage';

/** Barcode → product. Insertion order is the age, so the oldest entry is dropped first. */
type ProductCache = Readonly<Record<string, ScannedProduct>>;
/** A cached product as stored; entries from before liquids were detected have no `unit`. */
type StoredProduct = Omit<ScannedProduct, 'unit'> & { readonly unit?: ProductBaseUnit };

const PRODUCT_BASE_UNITS: readonly string[] = Object.values(PRODUCT_BASE_UNIT);

/** Grams in a serving text: `'30 g'`, `'1 bar (40 g)'`, `'12,5g'`. Not `'250 ml'`. */
const SERVING_GRAMS_PATTERN = /(\d+(?:[.,]\d+)?)\s*g\b/i;
/** A package size in a liquid unit: `'1 l'`, `'33 cl'`, `'500ml'`, `'1,5 L'`. */
const LIQUID_QUANTITY_PATTERN = /\d\s*(?:ml|cl|l)\b/i;
/** Macros are kept with one decimal per 100 g; scaling rounds to whole numbers. */
const MACRO_DECIMALS_FACTOR = 10;

/**
 * Looks products up by barcode in Open Food Facts (API v2) and maps them to `ScannedProduct`
 * with macros per 100 g.
 *
 * Found products are cached locally (`STORAGE_KEY.PRODUCT_CACHE`), and the cache is asked
 * first, so a product scanned before also works offline. Never errors: an unknown product or
 * one without kcal is `not-found`, a network error or timeout is `error`.
 *
 * Browsers don't allow setting `User-Agent`, and the app's requests go through the WebView,
 * so no custom User-Agent is sent.
 */
@Injectable({ providedIn: 'root' })
export class ProductLookupService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly t = injectTranslate();

  lookup(barcode: string): Observable<ProductLookupResult> {
    const cached = this.readCache()[barcode];
    if (cached) {
      return of({ status: 'found', product: cached });
    }
    return this.http
      .get<OpenFoodFactsProductResponse>(openFoodFactsProductUrl(barcode), {
        params: { fields: OPEN_FOOD_FACTS.FIELDS },
      })
      .pipe(
        timeout(PRODUCT_LOOKUP_TIMEOUT_MS),
        map((response) => toLookupResult(this.t, barcode, response)),
        tap((result) => {
          if (result.status === 'found') {
            this.writeCache(result.product);
          }
        }),
        catchError((error: unknown) => of(toErrorResult(barcode, error))),
      );
  }

  /** Drops malformed entries (an old app version or edited storage) instead of trusting them. */
  private readCache(): ProductCache {
    const stored = this.storage.read<unknown>(STORAGE_KEY.PRODUCT_CACHE);
    if (!isRecord(stored)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(stored)
        .filter(
          (entry): entry is [string, StoredProduct] =>
            isStoredProduct(entry[1]) && entry[1].barcode === entry[0],
        )
        .map(([barcode, product]) => [
          barcode,
          { ...product, unit: product.unit ?? PRODUCT_BASE_UNIT.GRAMS },
        ]),
    );
  }

  private writeCache(product: ScannedProduct): void {
    const entries = Object.entries(this.readCache()).filter(([code]) => code !== product.barcode);
    const kept = entries.slice(Math.max(0, entries.length - PRODUCT_CACHE_LIMIT + 1));
    this.storage.write<ProductCache>(STORAGE_KEY.PRODUCT_CACHE, {
      ...Object.fromEntries(kept),
      [product.barcode]: product,
    });
  }
}

/** Open Food Facts answers an unknown barcode with HTTP 404 and `status: 0`. */
function toErrorResult(barcode: string, error: unknown): ProductLookupResult {
  if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound) {
    return { status: 'not-found', barcode };
  }
  console.warn(`ProductLookupService: opslaget af ${barcode} fejlede.`, error);
  return { status: 'error', barcode };
}

/** `t` names a product Open Food Facts has no name for. */
export function toLookupResult(
  t: Translate,
  barcode: string,
  response: OpenFoodFactsProductResponse,
): ProductLookupResult {
  const product =
    response.status === OPEN_FOOD_FACTS.STATUS_FOUND && response.product
      ? toScannedProduct(t, barcode, response.product)
      : null;
  return product ? { status: 'found', product } : { status: 'not-found', barcode };
}

/** `null` when the product has no energy (kcal or kJ) – without it, it can't be logged. */
export function toScannedProduct(
  t: Translate,
  barcode: string,
  product: OpenFoodFactsProduct,
): ScannedProduct | null {
  const nutriments = product.nutriments ?? {};
  const kcal = toKcal(nutriments);
  if (kcal === null) {
    return null;
  }
  const name =
    product.product_name_da?.trim() ||
    product.product_name?.trim() ||
    t(BARCODE_SCANNER_TEXT_KEY.UNNAMED_PRODUCT, { barcode });
  const brand = product.brands?.split(',')[0]?.trim() || undefined;
  const unit = baseUnit(product);
  return {
    barcode,
    unit,
    item: {
      id: `${PRODUCT_ID_PREFIX}-${barcode}`,
      name,
      ...(brand ? { brand } : {}),
      quantity: `${PRODUCT_BASE_GRAMS} ${unit}`,
      kcal: Math.round(kcal),
      protein: roundMacro(toNumber(nutriments.proteins_100g) ?? 0),
      carbs: roundMacro(toNumber(nutriments.carbohydrates_100g) ?? 0),
      fat: roundMacro(toNumber(nutriments.fat_100g) ?? 0),
    },
    servingGrams: parseServingGrams(product.serving_size),
  };
}

/** kcal per 100 g, else kJ (`energy-kj_100g`, then `energy_100g`) converted to kcal. */
function toKcal(nutriments: OpenFoodFactsNutriments): number | null {
  const kcal = toNumber(nutriments['energy-kcal_100g']);
  if (kcal !== null) {
    return kcal;
  }
  const kj = toNumber(nutriments['energy-kj_100g']) ?? toNumber(nutriments.energy_100g);
  return kj === null ? null : kj / KJ_PER_KCAL;
}

/** Millilitres for a liquid (nutrition per 100 ml, or a package size in ml/cl/l), else grams. */
function baseUnit(product: OpenFoodFactsProduct): ProductBaseUnit {
  const isLiquid =
    product.nutrition_data_per === OPEN_FOOD_FACTS.NUTRITION_PER_100_ML ||
    LIQUID_QUANTITY_PATTERN.test(product.quantity ?? '');
  return isLiquid ? PRODUCT_BASE_UNIT.MILLILITRES : PRODUCT_BASE_UNIT.GRAMS;
}

function parseServingGrams(servingSize: string | undefined): number | null {
  const amount = servingSize ? SERVING_GRAMS_PATTERN.exec(servingSize)?.[1] : undefined;
  const grams = amount ? parseFloat(amount.replace(',', '.')) : NaN;
  return grams > 0 ? Math.round(grams) : null;
}

function toNumber(value: number | string | undefined): number | null {
  const parsed = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : value;
  return parsed !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMacro(value: number): number {
  return Math.round(value * MACRO_DECIMALS_FACTOR) / MACRO_DECIMALS_FACTOR;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStoredProduct(value: unknown): value is StoredProduct {
  if (!isRecord(value) || typeof value['barcode'] !== 'string' || !isRecord(value['item'])) {
    return false;
  }
  const item = value['item'];
  const servingGrams = value['servingGrams'];
  const unit = value['unit'];
  return (
    (unit === undefined || (typeof unit === 'string' && PRODUCT_BASE_UNITS.includes(unit))) &&
    typeof item['id'] === 'string' &&
    typeof item['name'] === 'string' &&
    typeof item['quantity'] === 'string' &&
    (item['brand'] === undefined || typeof item['brand'] === 'string') &&
    isNonNegativeNumber(item['kcal']) &&
    isNonNegativeNumber(item['protein']) &&
    isNonNegativeNumber(item['carbs']) &&
    isNonNegativeNumber(item['fat']) &&
    (servingGrams === null || isNonNegativeNumber(servingGrams))
  );
}
