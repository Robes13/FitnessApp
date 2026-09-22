import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tone } from '../../../core/models/tone';
import { clamp } from '../../../core/utils/math';

export type ProgressBarTone = Tone | 'inverse';
export type ProgressBarThickness = 'thin' | 'regular';

const PERCENT_MAX = 100;

/** Clamps a fraction to 0..1; invalid numbers (NaN, Infinity) become 0. */
export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, 0, 1);
}

/**
 * Horizontal progress bar (the design's 4/6 px track with a colored fill).
 * `value` is a fraction 0..1; the width animates when it changes.
 */
@Component({
  selector: 'app-ui-progress-bar',
  templateUrl: './ui-progress-bar.html',
  styleUrl: './ui-progress-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-progress-bar',
    role: 'progressbar',
    '[class]': 'hostClass()',
    '[attr.aria-valuemin]': 'percentMin',
    '[attr.aria-valuemax]': 'percentMax',
    '[attr.aria-valuenow]': 'percent()',
  },
})
export class UiProgressBar {
  readonly value = input(0);
  readonly tone = input<ProgressBarTone>('accent');
  readonly thickness = input<ProgressBarThickness>('regular');

  protected readonly percentMin = 0;
  protected readonly percentMax = PERCENT_MAX;

  /** The fill's width in percent, always within 0..100. */
  readonly percent = computed(() => Math.round(clampFraction(this.value()) * PERCENT_MAX));

  protected readonly hostClass = computed(
    () => `ui-progress-bar--${this.tone()} ui-progress-bar--${this.thickness()}`,
  );
  protected readonly fillClass = computed(() => `ui-progress-bar__fill--${this.tone()}`);
}
