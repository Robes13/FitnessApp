import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { PRODUCT_BASE_GRAMS } from '../../constants/barcode';
import { BarcodeScanOutcome, ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { FoodItem } from '../../models/food';
import { newId } from '../../utils/id';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner';
import { CUSTOM_FOOD_ID_PREFIX, FoodLogService } from '../food-log/food-log';
import { NutritionCalculator } from '../nutrition-calculator/nutrition-calculator';
import { ProductLookupService } from '../product-lookup/product-lookup';

/** The "Unknown item" form's values. */
export interface UnknownProductInput {
  readonly name: string;
  readonly quantity: string;
  readonly kcal: number | null;
  readonly protein: number | null;
}

/** Design's `saveNewFood`: an empty portion becomes '1 portion'. */
const DEFAULT_CUSTOM_QUANTITY = '1 portion';

/**
 * The domain side of the barcode scanner (`shared/components/barcode-scanner`), so the shared
 * component only holds presentation and form state: scanning with the camera, looking the
 * barcode up (each lookup counts one scan for the "10 scans" badge), scaling a product to an
 * amount, the duplicate-name check for the "Unknown item" form and building that custom food.
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

  /** Counts the scan when subscribed, then looks the barcode up. Never errors. */
  lookup(barcode: string): Observable<ProductLookupResult> {
    return defer(() => {
      this.scanner.recordScan();
      return this.productLookup.lookup(barcode);
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

  /** Whether the trimmed name is already one of the user's own foods. Empty is never taken. */
  isCustomFoodNameTaken(name: string): boolean {
    const trimmed = name.trim();
    return trimmed !== '' && this.foodLog.hasCustomFoodNamed(trimmed);
  }

  /** The custom food from the "Unknown item" form: carbs/fat 0, portion '1 portion' if empty. */
  toCustomFood(input: UnknownProductInput): FoodItem {
    return {
      id: newId(CUSTOM_FOOD_ID_PREFIX),
      name: input.name.trim(),
      quantity: input.quantity.trim() || DEFAULT_CUSTOM_QUANTITY,
      kcal: Math.round(input.kcal ?? 0),
      protein: Math.round(input.protein ?? 0),
      carbs: 0,
      fat: 0,
      isCustom: true,
    };
  }
}

/** `'150 g'`, or `'150 ml'` for a liquid – the unit of the product's base portion. */
export function formatAmount(product: ScannedProduct, amount: number): string {
  return `${Math.round(amount)} ${product.unit}`;
}
