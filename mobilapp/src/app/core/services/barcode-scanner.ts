import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { SCANNED_DEMO_ITEM } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { ScanResult } from '../models/food';
import { StorageService } from './storage';

/** Tid før stregkodescanneren melder et resultat (designets `runScan`). */
const DEFAULT_DELAY_MS = 2300;

/** Tid før scanneren melder resultat. Sæt til 0 i tests. */
export const SCAN_DELAY_MS = new InjectionToken<number>('SCAN_DELAY_MS', {
  providedIn: 'root',
  factory: () => DEFAULT_DELAY_MS,
});

/**
 * Dummy-scanner som i designet: der er intet kamera. Hver scanning tæller op, og hver anden
 * (lige numre) er en ukendt vare; de ulige finder `SCANNED_DEMO_ITEM`. Tælleren gemmes, så
 * mønsteret fortsætter på tværs af sessioner og "10 scanninger"-badget kan beregnes.
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
        return count % 2 === 0
          ? { status: 'unknown' }
          : { status: 'found', item: SCANNED_DEMO_ITEM };
      }),
    );
  }
}
