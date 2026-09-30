import { Injectable, inject } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { PRODUCT_BASE_GRAMS } from '../../constants/barcode';
import { BarcodeScanOutcome, ProductLookupResult, ScannedProduct } from '../../models/barcode';
import { FoodItem } from '../../models/food';
import { BarcodeScannerService } from '../barcode-scanner/barcode-scanner';
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
}

/** `'150 g'`, or `'150 ml'` for a liquid – the unit of the product's base portion. */
export function formatAmount(product: ScannedProduct, amount: number): string {
  return `${Math.round(amount)} ${product.unit}`;
}
