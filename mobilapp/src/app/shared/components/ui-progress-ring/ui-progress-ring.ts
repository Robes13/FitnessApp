import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { Tone } from '../../../core/models/tone';
import { clampFraction } from '../ui-progress-bar/ui-progress-bar';

/** The tones a ring is drawn in (the achievement medals and the default accent). */
export type ProgressRingTone = Extract<
  Tone,
  'accent' | 'positive' | 'negative' | 'info' | 'neutral'
>;
export type ProgressRingTrackTone = 'line' | 'neutral' | 'none';

const DEFAULT_DIAMETER = 48;
const DEFAULT_STROKE_WIDTH = 4;
const PERCENT_MAX = 100;

/**
 * Circular progress ring (day rings, calorie ring, step counter, badges).
 *
 * The ring is drawn with `stroke-dasharray` = the circumference and `stroke-dashoffset` =
 * circumference × (1 − value), rotated −90° so it starts at the top. Content in the center
 * is projected via `<ng-content>`. The size is bound as `--ring-size`.
 */
@Component({
  selector: 'app-ui-progress-ring',
  templateUrl: './ui-progress-ring.html',
  styleUrl: './ui-progress-ring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-progress-ring',
    role: 'progressbar',
    '[style.--ring-size.px]': 'diameter()',
    '[attr.aria-valuemin]': 'percentMin',
    '[attr.aria-valuemax]': 'percentMax',
    '[attr.aria-valuenow]': 'percent()',
  },
})
export class UiProgressRing {
  /** Fraction 0..1 (clamped). */
  readonly value = input(0);
  /** Outer diameter in px – used both as the viewBox and as the CSS size. */
  readonly diameter = input(DEFAULT_DIAMETER, { transform: numberAttribute });
  /** Stroke width in px (= SVG units, since the viewBox follows the diameter). */
  readonly strokeWidth = input(DEFAULT_STROKE_WIDTH, { transform: numberAttribute });
  readonly tone = input<ProgressRingTone>('accent');
  readonly trackTone = input<ProgressRingTrackTone>('line');

  protected readonly percentMin = 0;
  protected readonly percentMax = PERCENT_MAX;

  readonly percent = computed(() => Math.round(clampFraction(this.value()) * PERCENT_MAX));
  readonly center = computed(() => this.diameter() / 2);
  /** Radius to the stroke's center, so the stroke stays within the viewBox. */
  readonly radius = computed(() => Math.max(0, (this.diameter() - this.strokeWidth()) / 2));
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  /** The part of the circumference that is *not* drawn: circumference × (1 − value). */
  readonly dashOffset = computed(() => this.circumference() * (1 - clampFraction(this.value())));

  protected readonly viewBox = computed(() => `0 0 ${this.diameter()} ${this.diameter()}`);
  protected readonly hasTrack = computed(() => this.trackTone() !== 'none');
  protected readonly trackClass = computed(() => `ui-progress-ring__track--${this.trackTone()}`);
  protected readonly valueClass = computed(() => `ui-progress-ring__value--${this.tone()}`);
}
