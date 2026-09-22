import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { STORAGE_KEY } from '../constants/storage-key';
import { ScanResult } from '../models/food';
import { StorageService } from './storage';

/** Placeholder for the response time of a barcode lookup, so the UI shows its loading state. */
const DEFAULT_DELAY_MS = 2300;

/** Time before the scanner reports a result. Set to 0 in tests. */
export const SCAN_DELAY_MS = new InjectionToken<number>('SCAN_DELAY_MS', {
  providedIn: 'root',
  factory: () => DEFAULT_DELAY_MS,
});

/**
 * Barcode scanner.
 *
 * The app has neither a camera nor a product database yet, so every lookup ends up as
 * `unknown`, and the user is offered to create the item themselves. The scan counter is
 * real data and is saved, so the "10 scans" badge can be calculated.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private readonly storage = inject(StorageService);
  private readonly delayMs = inject(SCAN_DELAY_MS);
  private readonly scanCountState = signal<number>(
    this.storage.read<number>(STORAGE_KEY.SCAN_COUNT) ?? 0,
  );

  readonly scanCount: Signal<number> = this.scanCountState.asReadonly();

  scan(): Observable<ScanResult> {
    return timer(this.delayMs).pipe(
      map((): ScanResult => {
        const count = this.scanCountState() + 1;
        this.scanCountState.set(count);
        this.storage.write(STORAGE_KEY.SCAN_COUNT, count);
        return { status: 'unknown' };
      }),
    );
  }
}
