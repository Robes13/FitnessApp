import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  numberAttribute,
  viewChild,
} from '@angular/core';
import {
  RULER_BLEED_DRAGGING,
  RULER_BLEED_IDLE,
  RULER_DEFAULT_GLOW_REACH,
  RulerLabelFormatter,
  RulerTick,
  computeRulerGeometry,
  formatRulerLabel,
} from './ruler-geometry';
import { clamp } from '../../../core/utils/math';

/** 84 / 96 px høj – `--size-ruler-h` / `--size-ruler-h-lg`. */
export type UiRulerSize = 'md' | 'lg';

interface RulerTickView extends RulerTick {
  readonly cssClass: string;
}

interface DragStart {
  readonly clientX: number;
  /** Værdien under fingeren ved nedtryk – træk måles relativt til den. */
  readonly base: number;
}

const DEFAULT_STEP = 1;
const DEFAULT_TICK_UNIT = 1;
const DEFAULT_PX_PER_TICK = 8;
const DEFAULT_MAJOR_EVERY = 10;
const DEFAULT_MID_EVERY = 5;
const DEFAULT_LABEL_EVERY = 10;
/** Designet runder den committede værdi til tre decimaler (`Math.round(q * 1000) / 1000`). */
const COMMIT_PRECISION = 1000;

const KEY_STEP_DIRECTION: Record<string, number> = {
  ArrowRight: 1,
  ArrowUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
};

function tickClass(tick: RulerTick): string {
  const classes: string[] = [];
  if (tick.kind !== 'minor') {
    classes.push(`ui-ruler__tick--${tick.kind}`);
  }
  if (tick.glowPercent !== null) {
    classes.push('ui-ruler__tick--glow');
  }
  return classes.join(' ');
}

/**
 * Designets lineal: et spor af streger, der trækkes vandret under en fast orange midterlinje.
 * Brugeren trækker direkte i linealen (pointer capture) eller bruger piletasterne
 * (`role="slider"`). `value` committes i `step`-trin og klemmes fast til `min..max`;
 * `dragging` rapporterer, om der trækkes (gløden bliver kraftigere, og forælderen kan reagere).
 *
 * Værten er `display: block` med `overflow: hidden`; forælderen sætter margin, baggrund og
 * radius efter behov (vægt-siden lægger den i et kort med `--color-surface-3`).
 */
@Component({
  selector: 'app-ui-ruler',
  templateUrl: './ui-ruler.html',
  styleUrl: './ui-ruler.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-ruler',
    '[class]': 'hostClasses()',
    '[style.--ruler-offset.px]': 'offset()',
  },
})
export class UiRuler {
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly value = model.required<number>();
  /** Opløsning for den committede værdi (1 kg, 5 min, 100 skridt, 0,1 kg …). */
  readonly step = input(DEFAULT_STEP);
  /** Værdi pr. streg. */
  readonly tickUnit = input(DEFAULT_TICK_UNIT);
  /** Pixel pr. streg. */
  readonly pxPerTick = input(DEFAULT_PX_PER_TICK);
  readonly majorEvery = input(DEFAULT_MAJOR_EVERY);
  readonly midEvery = input(DEFAULT_MID_EVERY);
  readonly labelEvery = input(DEFAULT_LABEL_EVERY);
  readonly labelFormatter = input<RulerLabelFormatter>(formatRulerLabel);
  /** Hvor mange streger gløden rækker (designet: 6 for kg/cm, 8 for skridt). */
  readonly glowReach = input(RULER_DEFAULT_GLOW_REACH);
  /**
   * Glødens styrke i hvile, 0..1 (designet: .35 på opsummeringen, .4 på vægt, højde og
   * skridt). Under træk er den altid 1.
   */
  readonly glowStrength = input(RULER_BLEED_IDLE, { transform: numberAttribute });
  readonly size = input<UiRulerSize>('md');
  /** Skærmlæser-navn for slideren, fx "Vægt i kilo". */
  readonly ariaLabel = input('');
  readonly dragging = model(false);

  private readonly range = viewChild.required<ElementRef<HTMLElement>>('range');
  private dragStart: DragStart | null = null;

  private readonly pxPerUnit = computed(() => this.pxPerTick() / this.tickUnit());

  protected readonly geometry = computed(() =>
    computeRulerGeometry({
      min: this.min(),
      max: this.max(),
      value: this.value(),
      tickUnit: this.tickUnit(),
      pxPerTick: this.pxPerTick(),
      majorEvery: this.majorEvery(),
      midEvery: this.midEvery(),
      labelEvery: this.labelEvery(),
      bleed: this.dragging() ? RULER_BLEED_DRAGGING : this.glowStrength(),
      reach: this.glowReach(),
      labelFormatter: this.labelFormatter(),
    }),
  );
  protected readonly ticks = computed<readonly RulerTickView[]>(() =>
    this.geometry().ticks.map((tick) => ({ ...tick, cssClass: tickClass(tick) })),
  );
  protected readonly labels = computed(() => this.geometry().labels);
  protected readonly offset = computed(() => this.geometry().offset);

  protected readonly hostClasses = computed(
    () => `ui-ruler--${this.size()}${this.dragging() ? ' ui-ruler--dragging' : ''}`,
  );
  protected readonly ariaLabelAttr = computed(() => this.ariaLabel() || null);

  protected onPointerDown(event: PointerEvent): void {
    const element = this.range().nativeElement;
    const rect = element.getBoundingClientRect();
    const centreX = rect.left + rect.width / 2;
    const base = this.value() + (event.clientX - centreX) / this.pxPerUnit();
    this.dragStart = { clientX: event.clientX, base };
    this.dragging.set(true);
    this.commit(base);
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture er en forbedring (trækket fortsætter uden for elementet), ikke et krav –
      // ældre WebViews og testmiljøer uden Pointer Events skal stadig kunne bruge linealen.
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragStart) {
      return;
    }
    this.commit(this.dragStart.base + (event.clientX - this.dragStart.clientX) / this.pxPerUnit());
  }

  protected onPointerUp(): void {
    this.dragStart = null;
    this.dragging.set(false);
  }

  protected onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Home') {
      event.preventDefault();
      this.value.set(this.min());
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.value.set(this.max());
      return;
    }
    const direction = KEY_STEP_DIRECTION[event.key];
    if (direction === undefined) {
      return;
    }
    event.preventDefault();
    this.commit(this.value() + direction * this.step());
  }

  /** Runder til nærmeste `step`, fjerner flydende-tal-støj og klemmer fast til `min..max`. */
  private commit(raw: number): void {
    const step = this.step();
    const quantised = Math.round(raw / step) * step;
    const precise = Math.round(quantised * COMMIT_PRECISION) / COMMIT_PRECISION;
    this.value.set(clamp(precise, this.min(), this.max()));
  }
}
