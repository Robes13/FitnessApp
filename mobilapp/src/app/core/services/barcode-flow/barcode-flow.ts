import { Injectable, inject } from '@angular/core';
import { Observable, defer, of, switchMap } from 'rxjs';
import { PRODUCT_BASE_GRAMS, PRODUCT_BASE_UNIT } from '../../constants/barcode';
import { BarcodeScanOutcome, ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { FoodItem } from '../../models/food';
import { FoodDto } from '../../models/food-api';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner';
import { FoodLogService } from '../food-log/food-log';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { ProductLookupService } from '../product-lookup/product-lookup';

/**
 * The domain side of the barcode scanner (`shared/components/barcode-scanner`), so the shared
 * component only holds presentation and form state: scanning with the camera, looking the
 * barcode up (each lookup counts one scan for the "10 scans" badge) and scaling a product to an
 * amount.
 *
 * Nothing is logged or saved here – the component emits the item and its parent does that.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeFlowService {
  private readonly scanner = inject(BarcodeScannerService);
  private readonly productLookup = inject(ProductLookupService);
  private readonly foodLog = inject(FoodLogService);
  private readonly calculator = inject(NutritionCalculator);

  /** `false` in the browser: the UI offers typing the barcode instead. */
  readonly canScan: boolean = this.scanner.canScan;

  scan(): Promise<BarcodeScanOutcome> {
    return this.scanner.scan();
  }

  openSettings(): Promise<void> {
    return this.scanner.openSettings();
  }

  /**
   * Counts the scan when subscribed, then looks the barcode up: first in the user's own
   * catalogue (a food scanned before, or one created for a barcode Open Food Facts doesn't
   * know – 3.1-6a), then in the API's shared catalogue, then in Open Food Facts. Never errors.
   */
  lookup(barcode: string): Observable<ProductLookupResult> {
    return defer(() => {
      this.scanner.recordScan();
      const own = this.foodLog.foods().find((food) => food.barcode === barcode);
      return own
        ? of<ProductLookupResult>({ status: 'found', product: toCatalogueProduct(barcode, own) })
        : this.foodLog
            .findCatalogueFood(barcode)
            .pipe(
              switchMap((food) =>
                food
                  ? of<ProductLookupResult>({
                      status: 'found',
                      product: toCatalogueProduct(barcode, food),
                    })
                  : this.productLookup.lookup(barcode),
              ),
            );
    });
  }

  /** The product's item scaled from its 100 g/ml base to `amount` (`quantity` e.g. `'150 g'`). */
  scale(product: ScannedProduct, amount: number): FoodItem {
    return {
      ...product.item,
      ...this.calculator.scaleMacros(product.item, amount / PRODUCT_BASE_GRAMS),
      quantity: formatAmount(product, amount),
    };
  }
}

/** `'150 g'`, or `'150 ml'` for a liquid – the unit of the product's base portion. */
export function formatAmount(product: ScannedProduct, amount: number): string {
  return `${Math.round(amount)} ${product.unit}`;
}

/**
 * A catalogue food as a scanned product: the API's values per 100 g, or per 100 ml when the food
 * has a millilitre serving. The item keeps the food's id, so logging it reuses the food.
 *
 * ponytail: a food entered per piece/portion is per unit with a synthetic 100 g serving
 * (`SERVING_GRAMS_PER_UNIT`), so the scanner offers that unit as its "Portion" of 100 g. Upgrade
 * path: a nutrition basis per food in the API (api-gaps).
 */
function toCatalogueProduct(barcode: string, food: FoodDto): ScannedProduct {
  const unit = food.servings.some((serving) => serving.unit === 'Milliliter')
    ? PRODUCT_BASE_UNIT.MILLILITRES
    : PRODUCT_BASE_UNIT.GRAMS;
  const perUnit = food.servings.find(
    (serving) => serving.unit === 'Piece' || serving.unit === 'Serving',
  );
  return {
    barcode,
    unit,
    item: {
      id: String(food.foodId),
      name: food.name,
      quantity: `${PRODUCT_BASE_GRAMS} ${unit}`,
      kcal: food.caloriesPer100,
      protein: food.proteinPer100,
      carbs: food.carbohydratesPer100,
      fat: food.fatPer100,
      isCustom: food.createdByUserId !== null,
    },
    servingGrams: perUnit?.gramsPerUnit ?? null,
  };
}
