import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { WeightChangeTone } from '../../services/weight-view';
import {
  WEIGHT_CHART_HEIGHT,
  WEIGHT_CHART_WIDTH,
  computeWeightChartGeometry,
} from './weight-chart-geometry';

/** A curve needs two weigh-ins; with one, the user is told the curve is on its way. */
const EMPTY_MESSAGE_KEY = {
  none: 'weight.chart.emptyNone',
  single: 'weight.chart.emptySingle',
} as const;

/**
 * The chart card on the weight screen: the current weight, the range's name and change, the
 * curve with a gradient fill, the dashed goal line and a footer with range, goal weight and "Today".
 *
 * The component is pure presentation – the host is the card itself, and the range is selected by
 * the chips beneath it (in `WeightPage`).
 */
@Component({
  selector: 'app-weight-chart',
  imports: [TranslatePipe, UiEmptyState],
  templateUrl: './weight-chart.html',
  styleUrl: './weight-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-chart' },
})
export class WeightChart {
  /** The weight without a unit, e.g. `'75'` or `'74,5'`. */
  readonly weightText = input.required<string>();
  /** The curve's points in kg, oldest first. */
  readonly seriesKg = input.required<readonly number[]>();
  readonly goalWeightKg = input.required<number>();
  readonly goalWeightText = input.required<string>();
  /** `'Sidste 3 uger'`. */
  readonly rangeLabel = input.required<string>();
  /** `'-3 uger'` – the footer's left-hand label. */
  readonly rangeStartLabel = input.required<string>();
  /** `'−2,6 kg'`. */
  readonly deltaText = input.required<string>();
  readonly deltaTone = input.required<WeightChangeTone>();

  private readonly t = injectTranslate();

  protected readonly width = WEIGHT_CHART_WIDTH;
  protected readonly height = WEIGHT_CHART_HEIGHT;
  protected readonly viewBox = `0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`;

  protected readonly geometry = computed(() =>
    computeWeightChartGeometry(this.seriesKg(), this.goalWeightKg()),
  );
  protected readonly hasSeries = computed(() => this.geometry().linePath !== '');
  protected readonly emptyMessage = computed(() =>
    this.t(this.seriesKg().length === 0 ? EMPTY_MESSAGE_KEY.none : EMPTY_MESSAGE_KEY.single),
  );
  protected readonly chartLabel = computed(() =>
    this.t('weight.chart.ariaLabel', {
      range: this.rangeLabel().toLowerCase(),
      delta: this.deltaText(),
    }),
  );
  protected readonly deltaClass = computed(() => `weight-chart__delta--${this.deltaTone()}`);
}
