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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Subscription, map } from 'rxjs';
import {
  BARCODE_MAX_DIGITS,
  BARCODE_PATTERN,
  BARCODE_SCANNER_TEXT_KEY,
  BARCODE_SCANNER_TEXT_PARAMS,
  PRODUCT_BASE_GRAMS,
  PRODUCT_BASE_UNIT,
  SCAN_AMOUNT_MAX_GRAMS,
  SCAN_AMOUNT_MIN_GRAMS,
  SCAN_AMOUNT_PRESETS_GRAMS,
  amountAriaLabelKey,
} from '../../../core/constants/barcode';
import {
  BarcodeScanOutcome,
  ProductLookupResult,
  ScannedProduct,
} from '../../../core/models/barcode';
import { FoodItem } from '../../../core/models/food';
import { BarcodeFlowService, formatAmount } from '../../../core/services/barcode-flow/barcode-flow';
import { KeyboardService } from '../../../core/services/keyboard/keyboard';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { UiButton } from '../ui-button/ui-button';
import { UiFormError } from '../ui-form-error/ui-form-error';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';
import { FOCUSABLE_SELECTOR, UiSheet } from '../ui-sheet/ui-sheet';
import { UiSpinner } from '../ui-spinner/ui-spinner';
import { UiTextInput } from '../ui-text-input/ui-text-input';

/** What's shown: camera overlay, result sheet or "Unknown item" sheet (the sheets sit above the overlay). */
type BarcodeScannerScreen = 'scanner' | 'result' | 'unknown';

/**
 * The overlay's state while `screen` is `scanner`: waiting for the user, the camera is open,
 * the product is being looked up, or one of the ways a scan/lookup can fail.
 */
export type BarcodeScannerStatus =
  | 'idle'
  | 'scanning'
  | 'looking-up'
  | 'permission-denied'
  | 'unreadable'
  | 'module-installing'
  | 'lookup-error';

export type ScanVerdictTone = 'negative' | 'positive' | 'neutral';

export interface ScanVerdict {
  readonly tone: ScanVerdictTone;
  readonly text: string;
}

interface ScanPortionView {
  readonly grams: number;
  readonly label: string;
  readonly sub: string;
  readonly selected: boolean;
}

interface ScanStatView {
  readonly label: string;
  readonly value: number;
  readonly accent: boolean;
}

interface BarcodeForm {
  barcode: FormControl<string>;
}

interface AmountForm {
  grams: FormControl<number | null>;
}

interface UnknownFoodForm {
  name: FormControl<string>;
  quantity: FormControl<string>;
  kcal: FormControl<number | null>;
  protein: FormControl<number | null>;
}

/** Design's `retryUnknown`: a brief pause before scanning restarts after a sheet. */
const SCAN_RETRY_DELAY_MS = 300;
/** The line's idle position (design's `scanLine: 50`). */
const SCAN_LINE_IDLE_PERCENT = 50;
/** Design's `runScan`: 88% immediately, 14% after 700 ms, 62% after 1500 ms. */
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

/** Translation key of the overlay's status line per state (`idle` depends on whether the camera is available). */
const STATUS_MESSAGE_KEY: Readonly<Record<Exclude<BarcodeScannerStatus, 'idle'>, string>> = {
  scanning: BARCODE_SCANNER_TEXT_KEY.HINT_SCANNING,
  'looking-up': BARCODE_SCANNER_TEXT_KEY.HINT_LOOKING_UP,
  'permission-denied': BARCODE_SCANNER_TEXT_KEY.PERMISSION_DENIED,
  unreadable: BARCODE_SCANNER_TEXT_KEY.UNREADABLE,
  'module-installing': BARCODE_SCANNER_TEXT_KEY.MODULE_INSTALLING,
  'lookup-error': BARCODE_SCANNER_TEXT_KEY.LOOKUP_ERROR,
};
const ERROR_STATUSES: readonly BarcodeScannerStatus[] = [
  'permission-denied',
  'unreadable',
  'module-installing',
  'lookup-error',
];

/** Camera outcomes that end on the overlay with a message (`scanned`/`cancelled` are handled apart). */
const OUTCOME_STATUS: Readonly<
  Record<Exclude<BarcodeScanOutcome['status'], 'scanned' | 'cancelled'>, BarcodeScannerStatus>
> = {
  'permission-denied': 'permission-denied',
  unreadable: 'unreadable',
  'module-installing': 'module-installing',
  unavailable: 'idle',
};

/** Design's `verdict`: ≥ 15 g protein counts as a good protein source. */
const HIGH_PROTEIN_GRAMS = 15;

/**
 * Design's `verdict` texts (verbatim). `kcalRemaining` is the daily goal minus what's been eaten.
 * The protein line uses the item's actual grams, so the text follows the selected portion.
 */
export function buildScanVerdict(t: Translate, kcalRemaining: number, item: FoodItem): ScanVerdict {
  const leftAfter = kcalRemaining - item.kcal;
  if (leftAfter < 0) {
    return {
      tone: 'negative',
      text: t('shared.barcodeScanner.verdictOver', { kcalOver: Math.abs(leftAfter) }),
    };
  }
  if (item.protein >= HIGH_PROTEIN_GRAMS) {
    return {
      tone: 'positive',
      text: t('shared.barcodeScanner.verdictProtein', {
        protein: item.protein,
        kcalLeft: leftAfter,
      }),
    };
  }
  return {
    tone: 'neutral',
    text: t('shared.barcodeScanner.verdictFits', { kcalLeft: leftAfter }),
  };
}

/**
 * The barcode scanner: a full-screen overlay that opens the native camera, looks the barcode
 * up and shows the product with an adjustable amount. All domain work (camera, lookup, scan
 * count, scaling, the duplicate-name check) goes through the core facade `BarcodeFlowService`;
 * the component holds only presentation and form state. An unknown product opens the "Unknown item" sheet with a
 * small form. In the browser – and after a failed scan – the barcode can be typed instead.
 *
 * The parent owns `open`. Every way out of the scanner ultimately emits `closed` – even after
 * `found`, `customSaved`, `manualRequested` and `noBarcodeRequested` – so the parent only needs
 * one handler that sets `open` to `false`. Cancelling the camera closes the scanner.
 */
@Component({
  selector: 'app-barcode-scanner',
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiSheet,
    UiSpinner,
    UiTextInput,
    TranslatePipe,
  ],
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
  /** Open the camera automatically when the overlay opens (native only). Otherwise the user taps "Scan". */
  readonly autoStart = input(true, { transform: booleanAttribute });

  readonly closed = output<void>();
  /** The scanned item, scaled to the chosen amount (`quantity` e.g. `'150 g'`). */
  readonly found = output<FoodItem>();
  /** Unknown item saved from the form: name, portion (default '1 portion'), kcal, protein; carbs/fat 0. */
  readonly customSaved = output<FoodItem>();
  /** "Enter manually instead". */
  readonly manualRequested = output<void>();
  /** "The item has no barcode". */
  readonly noBarcodeRequested = output<void>();

  private readonly flow = inject(BarcodeFlowService);
  private readonly document = inject(DOCUMENT);
  private readonly t = injectTranslate();
  /** While typing a barcode the camera frame is only decoration, so it gives way to the field. */
  protected readonly keyboardOpen = inject(KeyboardService).isOpen;
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private lookupSubscription: Subscription | null = null;
  /** Bumped on every start/stop, so a camera result that arrives after closing is ignored. */
  private scanRun = 0;
  /** The element that had focus when the scanner opened – focus returns there on close. */
  private previouslyFocused: HTMLElement | null = null;

  protected readonly frame = SCAN_FRAME;
  protected readonly barWeights = BARCODE_BAR_WEIGHTS;
  protected readonly canScan = this.flow.canScan;
  protected readonly barcodeMaxLength = BARCODE_MAX_DIGITS;

  protected readonly screen = signal<BarcodeScannerScreen>('scanner');
  protected readonly status = signal<BarcodeScannerStatus>('idle');
  protected readonly scanLinePercent = signal(SCAN_LINE_IDLE_PERCENT);
  protected readonly product = signal<ScannedProduct | null>(null);
  /** The last barcode looked up – retried after a network error and shown on "Unknown item". */
  protected readonly barcode = signal('');

  protected readonly barcodeForm = new FormGroup<BarcodeForm>({
    barcode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(BARCODE_PATTERN)],
    }),
  });
  private readonly barcodeValue = toSignal(
    this.barcodeForm.controls.barcode.valueChanges.pipe(map((value) => value.trim())),
    { initialValue: '' },
  );
  /** Set on submit, so the digits error isn't shown while the user is still typing. */
  protected readonly barcodeSubmitted = signal(false);

  protected readonly amountForm = new FormGroup<AmountForm>({
    grams: new FormControl<number | null>(PRODUCT_BASE_GRAMS, [
      Validators.required,
      Validators.min(SCAN_AMOUNT_MIN_GRAMS),
      Validators.max(SCAN_AMOUNT_MAX_GRAMS),
    ]),
  });
  private readonly grams = toSignal(this.amountForm.controls.grams.valueChanges, {
    initialValue: this.amountForm.controls.grams.value,
  });

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

  protected readonly isBusy = computed(
    () => this.status() === 'scanning' || this.status() === 'looking-up',
  );
  protected readonly isLookingUp = computed(() => this.status() === 'looking-up');
  protected readonly hasError = computed(() => ERROR_STATUSES.includes(this.status()));
  protected readonly isPermissionDenied = computed(() => this.status() === 'permission-denied');
  protected readonly isLookupError = computed(() => this.status() === 'lookup-error');
  protected readonly showScanButton = computed(
    () => this.canScan && !this.isBusy() && !this.isLookupError(),
  );
  protected readonly hint = computed(() => {
    const status = this.status();
    if (status !== 'idle') {
      return this.t(STATUS_MESSAGE_KEY[status]);
    }
    return this.t(
      this.canScan
        ? BARCODE_SCANNER_TEXT_KEY.HINT_IDLE_NATIVE
        : BARCODE_SCANNER_TEXT_KEY.HINT_IDLE_WEB,
    );
  });

  protected readonly barcodeLabel = computed(() =>
    this.t(
      this.canScan
        ? BARCODE_SCANNER_TEXT_KEY.BARCODE_LABEL_NATIVE
        : BARCODE_SCANNER_TEXT_KEY.BARCODE_LABEL_WEB,
    ),
  );

  protected readonly barcodeError = computed(() =>
    this.barcodeSubmitted() && !BARCODE_PATTERN.test(this.barcodeValue())
      ? this.t(
          BARCODE_SCANNER_TEXT_KEY.INVALID_BARCODE,
          BARCODE_SCANNER_TEXT_PARAMS.INVALID_BARCODE,
        )
      : null,
  );
  protected readonly hasBarcodeError = computed(() => this.barcodeError() !== null);

  protected readonly isResultOpen = computed(() => this.screen() === 'result');
  protected readonly isUnknownOpen = computed(() => this.screen() === 'unknown');

  /** The chosen amount in grams, or `null` while the field is invalid. */
  private readonly validGrams = computed(() => {
    const grams = this.grams();
    return grams !== null && grams >= SCAN_AMOUNT_MIN_GRAMS && grams <= SCAN_AMOUNT_MAX_GRAMS
      ? grams
      : null;
  });
  protected readonly amountError = computed(() =>
    this.validGrams() === null
      ? this.t(BARCODE_SCANNER_TEXT_KEY.INVALID_AMOUNT, BARCODE_SCANNER_TEXT_PARAMS.INVALID_AMOUNT)
      : null,
  );
  protected readonly hasAmountError = computed(() => this.amountError() !== null);
  /** Grams, or millilitres for a liquid. */
  private readonly amountUnit = computed(() => this.product()?.unit ?? PRODUCT_BASE_UNIT.GRAMS);
  protected readonly amountLabel = computed(() =>
    this.t(BARCODE_SCANNER_TEXT_KEY.AMOUNT_LABEL, { unit: this.amountUnit() }),
  );
  protected readonly amountAriaLabel = computed(() =>
    this.t(amountAriaLabelKey(this.amountUnit())),
  );

  /** The product scaled to the chosen amount (design's `scanned`). */
  protected readonly scaledItem = computed<FoodItem | null>(() => {
    const product = this.product();
    const grams = this.validGrams();
    if (!product || grams === null) {
      return null;
    }
    return this.flow.scale(product, grams);
  });

  protected readonly resultTitle = computed(() => this.product()?.item.name ?? '');
  protected readonly resultSubtitle = computed(() => {
    const product = this.product();
    const grams = this.validGrams();
    if (!product) {
      return '';
    }
    const amount = grams === null ? '' : formatAmount(product, grams);
    return [product.item.brand, amount].filter(Boolean).join(' · ');
  });

  /** The package's serving (when known) and the fixed gram presets, each with its kcal. */
  protected readonly portions = computed<readonly ScanPortionView[]>(() => {
    const product = this.product();
    if (!product) {
      return [];
    }
    const selected = this.grams();
    const serving = product.servingGrams;
    const presets = SCAN_AMOUNT_PRESETS_GRAMS.filter((grams) => grams !== serving);
    const servingOption = serving === null ? [] : [serving];
    return [...servingOption, ...presets].map((grams) => {
      const kcal = this.t('shared.barcodeScanner.kcalAmount', {
        kcal: this.flow.scale(product, grams).kcal,
      });
      const isServing = grams === serving;
      const amount = formatAmount(product, grams);
      return {
        grams,
        label: isServing ? this.t(BARCODE_SCANNER_TEXT_KEY.SERVING_LABEL) : amount,
        sub: isServing ? `${amount} · ${kcal}` : kcal,
        selected: grams === selected,
      };
    });
  });

  protected readonly stats = computed<readonly ScanStatView[]>(() => {
    const item = this.scaledItem();
    if (!item) {
      return [];
    }
    return [
      { label: this.t('common.unit.kcal'), value: item.kcal, accent: true },
      { label: this.t('shared.barcodeScanner.stat.protein'), value: item.protein, accent: false },
      { label: this.t('shared.barcodeScanner.stat.carbs'), value: item.carbs, accent: false },
      { label: this.t('shared.barcodeScanner.stat.fat'), value: item.fat, accent: false },
    ];
  });

  protected readonly verdict = computed<ScanVerdict | null>(() => {
    const remaining = this.kcalRemaining();
    const item = this.scaledItem();
    return remaining === null || !item ? null : buildScanVerdict(this.t, remaining, item);
  });

  protected readonly canAddScanned = computed(() => this.scaledItem() !== null);

  protected readonly nameTaken = computed(() =>
    this.flow.isCustomFoodNameTaken(this.formValue().name),
  );
  protected readonly nameError = computed(() =>
    this.nameTaken() ? this.t(BARCODE_SCANNER_TEXT_KEY.DUPLICATE_NAME) : null,
  );

  protected readonly canSaveUnknown = computed(() => {
    const value = this.formValue();
    return value.name.trim() !== '' && (value.kcal ?? 0) > 0 && !this.nameTaken();
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

  /** Opens the camera. In the browser there's no camera; the overlay stays on the barcode field. */
  async startScan(): Promise<void> {
    this.cancelPending();
    this.screen.set('scanner');
    if (!this.canScan) {
      this.status.set('idle');
      return;
    }
    const run = ++this.scanRun;
    this.status.set('scanning');
    this.startSweep();
    const outcome = await this.flow.scan();
    if (run === this.scanRun) {
      this.onScanOutcome(outcome);
    }
  }

  /** The typed barcode (browser fallback, or after a failed scan). */
  protected submitBarcode(): void {
    this.barcodeSubmitted.set(true);
    const barcode = this.barcodeForm.controls.barcode.value.trim();
    if (BARCODE_PATTERN.test(barcode)) {
      this.lookup(barcode);
    }
  }

  /** "Try again" after a network error: the same barcode once more. */
  protected retryLookup(): void {
    this.lookup(this.barcode());
  }

  protected openSettings(): void {
    void this.flow.openSettings();
  }

  protected pickPortion(grams: number): void {
    this.amountForm.controls.grams.setValue(grams);
  }

  /** "Scan again" and close on both sheets: back to the overlay, and the camera again after a pause. */
  protected rescan(): void {
    this.cancelPending();
    this.screen.set('scanner');
    this.status.set('idle');
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    this.product.set(null);
    if (this.canScan) {
      this.schedule(() => void this.startScan(), SCAN_RETRY_DELAY_MS);
    }
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
    this.customSaved.emit(this.flow.toCustomFood(this.form.getRawValue()));
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
    if (this.autoStart() && this.canScan) {
      void this.startScan();
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
    this.status.set('idle');
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    this.product.set(null);
    this.barcode.set('');
    this.barcodeForm.reset();
    this.barcodeSubmitted.set(false);
    this.amountForm.reset({ grams: PRODUCT_BASE_GRAMS });
    this.form.reset();
  }

  private onScanOutcome(outcome: BarcodeScanOutcome): void {
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    switch (outcome.status) {
      case 'scanned':
        this.lookup(outcome.barcode);
        return;
      case 'cancelled':
        // 8b: the user closed the camera – leave without logging anything.
        this.finish();
        return;
      default:
        this.status.set(OUTCOME_STATUS[outcome.status]);
    }
  }

  private lookup(barcode: string): void {
    this.cancelPending();
    this.barcode.set(barcode);
    this.status.set('looking-up');
    this.startSweep();
    this.lookupSubscription = this.flow
      .lookup(barcode)
      .subscribe((result) => this.onLookupResult(result));
  }

  private onLookupResult(result: ProductLookupResult): void {
    this.lookupSubscription = null;
    this.scanLinePercent.set(SCAN_LINE_IDLE_PERCENT);
    switch (result.status) {
      case 'found':
        this.product.set(result.product);
        this.amountForm.reset({ grams: result.product.servingGrams ?? PRODUCT_BASE_GRAMS });
        this.status.set('idle');
        this.screen.set('result');
        return;
      case 'not-found':
        this.form.reset();
        this.status.set('idle');
        this.screen.set('unknown');
        return;
      case 'error':
        this.status.set('lookup-error');
    }
  }

  private startSweep(): void {
    for (const step of SCAN_LINE_SWEEP) {
      if (step.atMs === 0) {
        this.scanLinePercent.set(step.percent);
      } else {
        this.schedule(() => this.scanLinePercent.set(step.percent), step.atMs);
      }
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
    this.scanRun += 1;
    for (const handle of this.timers) {
      clearTimeout(handle);
    }
    this.timers.clear();
    this.lookupSubscription?.unsubscribe();
    this.lookupSubscription = null;
  }
}
