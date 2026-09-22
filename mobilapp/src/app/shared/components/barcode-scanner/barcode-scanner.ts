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

/** Hvad der vises: kameraoverlay, resultat-ark eller "Ukendt vare"-ark (arkene ligger over overlayet). */
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

/** Designets `openScan`: linjen står stille et halvt sekund, før `runScan` går i gang. */
const SCAN_START_DELAY_MS = 500;
/** Designets `retryUnknown`: kort pause, før scanningen genstarter efter et ark. */
const SCAN_RETRY_DELAY_MS = 300;
/** Linjens hvileposition (designets `scanLine: 50`). */
const SCAN_LINE_IDLE_PERCENT = 50;
/** Designets `runScan`: 88 % straks, 14 % efter 700 ms, 62 % efter 1500 ms. Servicen svarer ved 2300 ms. */
const SCAN_LINE_SWEEP: readonly { readonly atMs: number; readonly percent: number }[] = [
  { atMs: 0, percent: 88 },
  { atMs: 700, percent: 14 },
  { atMs: 1500, percent: 62 },
];
/** Designets `seed`: 30 stregers relative bredder i den tegnede stregkode. */
const BARCODE_BAR_WEIGHTS: readonly number[] = [
  3, 1, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 3, 1,
];

/**
 * Scan-rammens geometri i px fra designet (260×170, streger 30 px inde / 55 px nede / 60 px høje,
 * 3 px mellemrum, linjen 16 px inde). Bindes som CSS-variabler på rammen – der findes ingen tokens
 * for et kamerasøgefelt.
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

/** Designets `scanPortions`: "Halv" og "1 bar" (varen er en proteinbar). */
const SCAN_PORTIONS: readonly ScanPortionOption[] = [
  { multiplier: 0.5, label: 'Halv' },
  { multiplier: 1, label: '1 bar' },
];

const SCAN_HINT_SCANNING = 'Læser stregkode…';
const SCAN_HINT_IDLE = 'Hold stregkoden inden for rammen – vi scanner automatisk';

/** Designets `verdict`: ≥ 15 g protein tæller som en god proteinkilde. */
const HIGH_PROTEIN_GRAMS = 15;
/** Designets `saveNewFood`: tom portion bliver til '1 portion'. */
const DEFAULT_CUSTOM_QUANTITY = '1 portion';
const CUSTOM_FOOD_ID_PREFIX = 'custom';

/**
 * Designets `verdict`-tekster (ordret). `kcalRemaining` er dagens mål minus det spiste.
 * Proteinlinjen bruger varens faktiske gram – for demo-varen ved 1× giver det designets "20 g".
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
 * Stregkodescanneren fra designet: et fuldskærms-overlay med søgefelt, tegnet stregkode og en
 * orange linje, der fejer 88 % → 14 % → 62 %, mens `BarcodeScannerService` "læser". Fund åbner
 * resultat-arket (portion, makroer, verdict), ellers åbnes "Ukendt vare"-arket med en lille
 * formular.
 *
 * Forælderen ejer `open`. Alle veje ud af scanneren udsender `closed` til sidst – også efter
 * `found`, `customSaved`, `manualRequested` og `noBarcodeRequested` – så forælderen kun behøver
 * én handler, der sætter `open` til `false`. Scanningen genstarter, hver gang arket åbnes.
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
  /** Dagens kalorier tilbage (mål − spist). `null` skjuler verdict-boksen. */
  readonly kcalRemaining = input<number | null>(null);
  /** Måltidet varen lægges under. Indgår ikke i teksterne (designet siger blot "Gem og tilføj"). */
  readonly mealLabel = input('');
  /** Start scanningen automatisk, når overlayet åbner. Ellers kaldes `startScan()` af forælderen. */
  readonly autoStart = input(true, { transform: booleanAttribute });

  readonly closed = output<void>();
  /** Den scannede vare, skaleret til den valgte portion. */
  readonly found = output<FoodItem>();
  /** Ukendt vare gemt fra formularen: navn, portion (standard '1 portion'), kcal, protein; kulhydrat/fedt 0. */
  readonly customSaved = output<FoodItem>();
  /** "Indtast manuelt i stedet". */
  readonly manualRequested = output<void>();
  /** "Varen har ingen stregkode". */
  readonly noBarcodeRequested = output<void>();

  private readonly scanner = inject(BarcodeScannerService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly document = inject(DOCUMENT);
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');

  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private scanSubscription: Subscription | null = null;
  /** Elementet, der havde fokus, da scanneren åbnede – fokus gives tilbage dertil ved luk. */
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

  /** Varen skaleret til den valgte portion (designets `scanned`). */
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

    // Flyt fokus ind i overlayet, når det åbner – men ikke væk fra et ark, der ligger ovenpå.
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

  /** Starter (eller genstarter) en scanning med det samme. */
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

  /** "Scan igen" og luk på begge ark: tilbage til søgefeltet og ny scanning efter en kort pause. */
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
    // Arkene håndterer selv Escape via UiSheet; overlayet reagerer kun, når det ligger øverst.
    if (!this.open() || this.screen() !== 'scanner') {
      return;
    }
    event.preventDefault();
    this.finish();
  }

  /**
   * Holder Tab inde i kameraoverlayet, så et `aria-modal`-overlay ikke kan tabbes væk.
   * Ligger et ark ovenpå (`screen() !== 'scanner'`), ejer `UiSheet` fælden – samme
   * arbejdsdeling som for Escape. Retningen kommer fra host-bindingen, da `$event` her
   * kun er typet `Event`.
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

  /** Gemmer det element, der åbnede scanneren – kun første gang, overlayet tager fokus. */
  private rememberTrigger(): void {
    if (this.previouslyFocused === null) {
      const active = this.document.activeElement;
      this.previouslyFocused = active instanceof HTMLElement ? active : null;
    }
  }

  /** Giver fokus tilbage til det gemte element. Gør intet, hvis overlayet aldrig tog fokus. */
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
