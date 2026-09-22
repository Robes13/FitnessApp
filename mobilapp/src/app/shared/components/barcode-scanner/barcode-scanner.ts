import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { newId } from '../../../core/utils/id';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Subscription, map } from 'rxjs';
import { FoodItem, ScanResult } from '../../../core/models/food';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { UiButton } from '../ui-button/ui-button';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';
import { FOCUSABLE_SELECTOR, UiSheet } from '../ui-sheet/ui-sheet';
import { UiTextInput } from '../ui-text-input/ui-text-input';

/** What's shown: camera overlay, result sheet or "Unknown item" sheet (the sheets sit above the overlay). */
type BarcodeScannerScreen = 'scanner' | 'result' | 'unknown';

export type ScanVerdictTone = 'negative' | 'positive' | 'neutral';

export interface ScanVerdict {
  readonly tone: ScanVerdictTone;
  readonly text: string;
}

interface ScanPortionOption {
  readonly multiplier: number;
  readonly label: string;
}

interface ScanPortionView extends ScanPortionOption {
  readonly sub: string;
  readonly selected: boolean;
}

interface ScanStatView {
  readonly label: string;
  readonly value: number;
  readonly accent: boolean;
}

interface UnknownFoodForm {
  name: FormControl<string>;
  quantity: FormControl<string>;
  kcal: FormControl<number | null>;
  protein: FormControl<number | null>;
}

/** Design's `openScan`: the line stands still for half a second before `runScan` kicks in. */
const SCAN_START_DELAY_MS = 500;
/** Design's `retryUnknown`: a brief pause before scanning restarts after a sheet. */
const SCAN_RETRY_DELAY_MS = 300;
/** The line's idle position (design's `scanLine: 50`). */
const SCAN_LINE_IDLE_PERCENT = 50;
/** Design's `runScan`: 88% immediately, 14% after 700 ms, 62% after 1500 ms. The service responds at 2300 ms. */
const SCAN_LINE_SWEEP: readonly { readonly atMs: number; readonly percent: number }[] = [
  { atMs: 0, percent: 88 },
  { atMs: 700, percent: 14 },
  { atMs: 1500, percent: 62 },
];
/** Design's `seed`: the relative widths of 30 bars in the drawn barcode. */
const BARCODE_BAR_WEIGHTS: readonly number[] = [
  3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 3, 1,
];

/**
 * The scan frame's geometry in px from the design (260×170, bars 30 px in / 55 px down / 60 px
 * tall, 3 px gap, the line 16 px in). Bound as CSS variables on the frame – there are no tokens
 * for a camera viewfinder.
 */
const SCAN_FRAME = {
  width: 260,
  height: 170,
  barsInsetX: 30,
  barsTop: 55,
  barsHeight: 60,
  barGap: 3,
  lineInsetX: 16,
} as const;

/** Design's `scanPortions`: "Half" and "1 bar" (the item is a protein bar). */
const SCAN_PORTIONS: readonly ScanPortionOption[] = [
  { multiplier: 0.5, label: 'Halv' },
  { multiplier: 1, label: '1 bar' },
];

const SCAN_HINT_SCANNING = 'Læser stregkode…';
const SCAN_HINT_IDLE = 'Hold stregkoden inden for rammen – vi scanner automatisk';

/** Design's `verdict`: ≥ 15 g protein counts as a good protein source. */
const HIGH_PROTEIN_GRAMS = 15;
/** Design's `saveNewFood`: an empty portion becomes '1 portion'. */
const DEFAULT_CUSTOM_QUANTITY = '1 portion';
const CUSTOM_FOOD_ID_PREFIX = 'custom';

/**
 * Design's `verdict` texts (verbatim). `kcalRemaining` is the daily goal minus what's been eaten.
 * The protein line uses the item's actual grams, so the text follows the selected portion.
 */
export function buildScanVerdict(kcalRemaining: number, item: FoodItem): ScanVerdict {
  const leftAfter = kcalRemaining - item.kcal;
  if (leftAfter < 0) {
    return {
      tone: 'negative',
      text: `Den skubber dig ${Math.abs(leftAfter)} kcal over dagens mål. Overvej en halv, eller gem den til efter træning.`,
    };
  }
  if (item.protein >= HIGH_PROTEIN_GRAMS) {
    return {
      tone: 'positive',
      text: `God proteinkilde – ${item.protein} g protein. Du har ${leftAfter} kcal tilbage bagefter.`,
    };
  }
  return { tone: 'neutral', text: `Passer fint ind. ${leftAfter} kcal tilbage bagefter.` };
}

/**
 * The barcode scanner from the design: a full-screen overlay with a viewfinder, a drawn barcode
 * and an orange line that sweeps 88% → 14% → 62% while `BarcodeScannerService` "reads". A find
 * opens the result sheet (portion, macros, verdict), otherwise the "Unknown item" sheet opens
 * with a small form.
 *
 * The parent owns `open`. Every way out of the scanner ultimately emits `closed` – even after
 * `found`, `customSaved`, `manualRequested` and `noBarcodeRequested` – so the parent only needs
 * one handler that sets `open` to `false`. Scanning restarts every time the sheet opens.
 */
@Component({
  selector: 'app-barcode-scanner',
  imports: [ReactiveFormsModule, UiButton, UiIcon, UiIconButton, UiSheet, UiTextInput],
  templateUrl: './barcode-scanner.html',
  styleUrl: './barcode-scanner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'barcode-scanner',
    '(document:keydown.escape)': 'onEscape($event)',
    '(document:keydown.tab)': 'onTab($event, false)',
    '(document:keydown.shift.tab)': 'onTab($event, true)',
  },
})
export class BarcodeScanner {
  readonly open = input.required<boolean>();
  /** Today's remaining calories (goal − eaten). `null` hides the verdict box. */
  readonly kcalRemaining = input<number | null>(null);
  /** The meal the item is logged under. Not part of the texts (the design just says "Save and add"). */
  readonly mealLabel = input('');
  /** Start scanning automatically when the overlay opens. Otherwise the parent calls `startScan()`. */
  readonly autoStart = input(true, { transform: booleanAttribute });

  readonly closed = output<void>();
  /** The scanned item, scaled to the selected portion. */
  readonly found = output<FoodItem>();
  /** Unknown item saved from the form: name, portion (default '1 portion'), kcal, protein; carbs/fat 0. */
  readonly customSaved = output<FoodItem>();
  /** "Enter manually instead". */
  readonly manualRequested = output<void>();
  /** "The item has no barcode". */
  readonly noBarcodeRequested = output<void>();

  private readonly scanner = inject(BarcodeScannerService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly document = inject(DOCUMENT);
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private scanSubscription: Subscription | null = null;
  /** The element that had focus when the scanner opened – focus returns there on close. */
  private previouslyFocused: HTMLElement | null = null;

  protected readonly frame = SCAN_FRAME;
  protected readonly barWeights = BARCODE_BAR_WEIGHTS;

  protected readonly screen = signal<BarcodeScannerScreen>('scanner');
  protected readonly scanning = signal(false);
  protected readonly scanLinePercent = signal(SCAN_LINE_IDLE_PERCENT);
  protected readonly scannedItem = signal<FoodItem | null>(null);
  protected readonly multiplier = signal(1);

  protected readonly form = new FormGroup<UnknownFoodForm>({
    name: new FormControl('', { nonNullable: true }),
    quantity: new FormControl('', { nonNullable: true }),
    kcal: new FormControl<number | null>(null),
    protein: new FormControl<number | null>(null),
  });
  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(map(() => this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  protected readonly hint = computed(() => (this.scanning() ? SCAN_HINT_SCANNING : SCAN_HINT_IDLE));
  protected readonly isResultOpen = computed(() => this.screen() === 'result');
  protected readonly isUnknownOpen = computed(() => this.screen() === 'unknown');

  private readonly baseQuantity = computed(() => {
    const item = this.scannedItem();
    return item ? this.calculator.parseQuantity(item.quantity) : null;
  });

  /** The item scaled to the selected portion (design's `scanned`). */
  protected readonly scaledItem = computed<FoodItem | null>(() => {
    const item = this.scannedItem();
    const base = this.baseQuantity();
    if (!item || !base) {
      return null;
    }
    const ratio = this.multiplier();
    return {
      ...item,
      ...this.calculator.scaleMacros(item, ratio),
      quantity: this.formatQuantity(base.amount * ratio, base.unit),
    };
  });

  protected readonly resultTitle = computed(() => this.scannedItem()?.name ?? '');
  protected readonly resultSubtitle = computed(() => {
    const item = this.scaledItem();
    return item ? [item.brand, item.quantity].filter(Boolean).join(' · ') : '';
  });

  protected readonly portions = computed<readonly ScanPortionView[]>(() => {
    const base = this.baseQuantity();
    const selected = this.multiplier();
    return SCAN_PORTIONS.map((portion) => ({
      ...portion,
      sub: base ? this.formatQuantity(base.amount * portion.multiplier, base.unit) : '',
      selected: portion.multiplier === selected,
    }));
  });

  protected readonly stats = computed<readonly ScanStatView[]>(() => {
    const item = this.scaledItem();
    if (!item) {
      return [];
    }
    return [
      { label: 'kcal', value: item.kcal, accent: true },
      { label: 'protein', value: item.protein, accent: false },
      { label: 'kulhydrat', value: item.carbs, accent: false },
      { label: 'fedt', value: item.fat, accent: false },
    ];
  });

  protected readonly verdict = computed<ScanVerdict | null>(() => {
    const remaining = this.kcalRemaining();
    const item = this.scaledItem();
    return remaining === null || !item ? null : buildScanVerdict(remaining, item);
  });

  protected readonly canSaveUnknown = computed(() => {
    const value = this.formValue();
    return value.name.trim() !== '' && (value.kcal ?? 0) > 0;
  });

  constructor() {
    effect(() => {
      const isOpen = this.open();
      untracked(() => (isOpen ? this.begin() : this.stop()));
    });
    inject(DestroyRef).onDestroy(() => this.stop());

    // Move focus into the overlay when it opens – but not away from a sheet lying on top.
    afterRenderEffect(() => {
      const overlay = this.overlay()?.nativeElement;
      if (
        overlay &&
        this.screen() === 'scanner' &&
        !overlay.contains(this.document.activeElement)
      ) {
        this.rememberTrigger();
        overlay.focus({ preventScroll: true });
      }
    });
  }

  /** Starts (or restarts) a scan immediately. */
  startScan(): void {
    this.cancelPending();
    this.screen.set('scanner');
    this.scanning.set(true);
    for (const step of SCAN_LINE_SWEEP) {
      if (step.atMs === 0) {
        this.scanLinePercent.set(step.percent);
      } else {
        this.schedule(() => this.scanLinePercent.set(step.percent), step.atMs);
      }
    }
    this.scanSubscription = this.scanner.scan().subscribe((result) => this.onScanResult(result));
  }

  protected pickPortion(multiplier: number): void {
    this.multiplier.set(multiplier);
  }

  /** "Scan again" and close on both sheets: back to the viewfinder and a new scan after a short pause. */
  protected rescan(): void {
    this.cancelPending();
    this.screen.set('scanner');
    this.scanning.set(false);
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    this.schedule(() => this.startScan(), SCAN_RETRY_DELAY_MS);
  }

  protected addScanned(): void {
    const item = this.scaledItem();
    if (!item) {
      return;
    }
    this.found.emit(item);
    this.finish();
  }

  protected saveUnknown(): void {
    if (!this.canSaveUnknown()) {
      return;
    }
    const value = this.form.getRawValue();
    this.customSaved.emit({
      id: newId(CUSTOM_FOOD_ID_PREFIX),
      name: value.name.trim(),
      quantity: value.quantity.trim() || DEFAULT_CUSTOM_QUANTITY,
      kcal: Math.round(value.kcal ?? 0),
      protein: Math.round(value.protein ?? 0),
      carbs: 0,
      fat: 0,
      isCustom: true,
    });
    this.finish();
  }

  protected requestManual(): void {
    this.manualRequested.emit();
    this.finish();
  }

  protected requestNoBarcode(): void {
    this.noBarcodeRequested.emit();
    this.finish();
  }

  protected close(): void {
    this.finish();
  }

  protected onEscape(event: Event): void {
    // The sheets handle Escape themselves via UiSheet; the overlay only reacts when it's on top.
    if (!this.open() || this.screen() !== 'scanner') {
      return;
    }
    event.preventDefault();
    this.finish();
  }

  /**
   * Keeps Tab inside the camera overlay, so an `aria-modal` overlay can't be tabbed away from.
   * If a sheet lies on top (`screen() !== 'scanner'`), `UiSheet` owns the trap – the same
   * division of labor as for Escape. The direction comes from the host binding, since `$event`
   * here is only typed as `Event`.
   */
  protected onTab(event: Event, backwards: boolean): void {
    if (!this.open() || this.screen() !== 'scanner') {
      return;
    }
    const overlay = this.overlay()?.nativeElement;
    if (!overlay) {
      return;
    }
    const focusable = Array.from(overlay.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      overlay.focus({ preventScroll: true });
      return;
    }
    const active = this.document.activeElement;
    if (!overlay.contains(active)) {
      event.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (backwards && (active === first || active === overlay)) {
      event.preventDefault();
      last.focus({ preventScroll: true });
      return;
    }
    if (!backwards && active === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  private begin(): void {
    this.reset();
    if (this.autoStart()) {
      this.schedule(() => this.startScan(), SCAN_START_DELAY_MS);
    }
  }

  private finish(): void {
    this.stop();
    this.closed.emit();
  }

  private stop(): void {
    this.cancelPending();
    this.reset();
    this.restoreFocus();
  }

  /** Stores the element that opened the scanner – only the first time the overlay takes focus. */
  private rememberTrigger(): void {
    if (this.previouslyFocused === null) {
      const active = this.document.activeElement;
      this.previouslyFocused = active instanceof HTMLElement ? active : null;
    }
  }

  /** Returns focus to the stored element. Does nothing if the overlay never took focus. */
  private restoreFocus(): void {
    this.previouslyFocused?.focus({ preventScroll: true });
    this.previouslyFocused = null;
  }

  private reset(): void {
    this.screen.set('scanner');
    this.scanning.set(false);
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    this.scannedItem.set(null);
    this.multiplier.set(1);
    this.form.reset();
  }

  private onScanResult(result: ScanResult): void {
    this.scanning.set(false);
    this.scanSubscription = null;
    if (result.status === 'found') {
      this.scannedItem.set(result.item);
      this.multiplier.set(1);
      this.screen.set('result');
    } else {
      this.form.reset();
      this.screen.set('unknown');
    }
  }

  private schedule(callback: () => void, delayMs: number): void {
    const handle = setTimeout(() => {
      this.timers.delete(handle);
      callback();
    }, delayMs);
    this.timers.add(handle);
  }

  private cancelPending(): void {
    for (const handle of this.timers) {
      clearTimeout(handle);
    }
    this.timers.clear();
    this.scanSubscription?.unsubscribe();
    this.scanSubscription = null;
  }

  private formatQuantity(amount: number, unit: string): string {
    return `${Math.round(amount)} ${unit}`;
  }
}
