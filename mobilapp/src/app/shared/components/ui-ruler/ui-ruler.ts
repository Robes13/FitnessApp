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

/** 84 / 96 px tall – `--size-ruler-h` / `--size-ruler-h-lg`. */
export type UiRulerSize = 'md' | 'lg';

interface RulerTickView extends RulerTick {
  readonly cssClass: string;
}

interface DragStart {
  readonly clientX: number;
  /** The value at touch-down – dragging is measured from it, and a cancelled touch restores it. */
  readonly value: number;
}

const DEFAULT_STEP = 1;
const DEFAULT_TICK_UNIT = 1;
const DEFAULT_PX_PER_TICK = 8;
/** Every 10th tick is tall, every 5th medium (the design's absolute tick number). */
const MAJOR_EVERY = 10;
const MID_EVERY = 5;
const DEFAULT_LABEL_EVERY = 10;
/** The design rounds the committed value to three decimals (`Math.round(q * 1000) / 1000`). */
const COMMIT_PRECISION = 1000;
/** Horizontal movement (px) before a touch drags the ruler – below it, a tap changes nothing. */
const DRAG_SLOP_PX = 6;

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
 * The design's ruler: a track of ticks that is dragged horizontally under a fixed orange
 * center line. The user drags the track with the finger (pointer capture) or uses the arrow keys
 * (`role="slider"`). `value` is committed in `step` increments and clamped to `min..max`;
 * `dragging` reports whether dragging is in progress (the glow gets stronger, and the parent
 * can react).
 *
 * Only a horizontal drag changes the value: a tap does nothing, and a vertical swipe scrolls the
 * page (`touch-action: pan-y`) – the browser then cancels the pointer, and the value is restored.
 *
 * The host is `display: block` with `overflow: hidden`; the parent sets margin, background and
 * radius as needed (the weight page places it in a card with `--color-surface-3`).
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
  /** Resolution for the committed value (1 kg, 5 min, 100 steps, 0.1 kg …). */
  readonly step = input(DEFAULT_STEP);
  /** Value per tick. */
  readonly tickUnit = input(DEFAULT_TICK_UNIT);
  /** Pixels per tick. */
  readonly pxPerTick = input(DEFAULT_PX_PER_TICK);
  readonly labelEvery = input(DEFAULT_LABEL_EVERY);
  readonly labelFormatter = input<RulerLabelFormatter>(formatRulerLabel);
  /** How many ticks the glow reaches (the design: 6 for kg/cm, 8 for steps). */
  readonly glowReach = input(RULER_DEFAULT_GLOW_REACH);
  /**
   * The glow's strength at rest, 0..1 (the design: .35 on the summary, .4 on weight, height and
   * steps). While dragging it's always 1.
   */
  readonly glowStrength = input(RULER_BLEED_IDLE, { transform: numberAttribute });
  readonly size = input<UiRulerSize>('md');
  /** Screen reader name for the slider, e.g. "Weight in kilos". */
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
      majorEvery: MAJOR_EVERY,
      midEvery: MID_EVERY,
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
    this.dragStart = { clientX: event.clientX, value: this.value() };
    try {
      this.range().nativeElement.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement (dragging continues outside the element), not a
      // requirement – older WebViews and test environments without Pointer Events must still
      // be able to use the ruler.
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const start = this.dragStart;
    if (!start) {
      return;
    }
    if (!this.dragging()) {
      if (Math.abs(event.clientX - start.clientX) < DRAG_SLOP_PX) {
        return;
      }
      // Measure from here, so passing the slop doesn't make the value jump.
      this.dragStart = { ...start, clientX: event.clientX };
      this.dragging.set(true);
      return;
    }
    // The track follows the finger: dragging to the right brings lower values under the line.
    this.commit(start.value - (event.clientX - start.clientX) / this.pxPerUnit());
  }

  protected onPointerUp(): void {
    this.dragStart = null;
    this.dragging.set(false);
  }

  /** The browser took the touch over (a vertical swipe scrolls the page): undo what it dragged. */
  protected onPointerCancel(): void {
    if (this.dragStart) {
      this.value.set(this.dragStart.value);
    }
    this.onPointerUp();
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

  /** Rounds to the nearest `step`, removes floating-point noise and clamps to `min..max`. */
  private commit(raw: number): void {
    const step = this.step();
    const quantised = Math.round(raw / step) * step;
    const precise = Math.round(quantised * COMMIT_PRECISION) / COMMIT_PRECISION;
    this.value.set(clamp(precise, this.min(), this.max()));
  }
}
