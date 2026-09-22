import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Tone } from '../../../core/models/tone';
import { clamp } from '../../../core/utils/math';

export type ProgressBarTone = Tone | 'inverse';
export type ProgressBarThickness = 'thin' | 'regular';

const PERCENT_MAX = 100;

/** Klemmer en andel fast til 0..1; ugyldige tal (NaN, Infinity) bliver 0. */
export function clampFraction(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return clamp(value, 0, 1);
}

/**
 * Vandret fremdriftsbjælke (designets 4/6 px skinne med farvet fyld).
 * `value` er en andel 0..1; bredden animeres, når den ændrer sig.
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

  /** Fyldets bredde i procent, altid inden for 0..100. */
  readonly percent = computed(() => Math.round(clampFraction(this.value()) * PERCENT_MAX));

  protected readonly hostClass = computed(
    () => `ui-progress-bar--${this.tone()} ui-progress-bar--${this.thickness()}`,
  );
  protected readonly fillClass = computed(() => `ui-progress-bar__fill--${this.tone()}`);
}
