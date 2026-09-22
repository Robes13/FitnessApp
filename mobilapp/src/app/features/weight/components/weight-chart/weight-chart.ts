import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { WeightChangeTone } from '../../services/weight-view';
import {
  WEIGHT_CHART_HEIGHT,
  WEIGHT_CHART_WIDTH,
  computeWeightChartGeometry,
} from './weight-chart-geometry';

/**
 * Grafkortet på vægt-skærmen: den aktuelle vægt, intervallets navn og udvikling, kurven med
 * gradientflade, den stiplede mållinje og en fodnote med interval, målvægt og "I dag".
 *
 * Komponenten er ren visning – værten er selve kortet, og intervallet vælges af chipsene
 * under den (i `WeightPage`).
 */
@Component({
  selector: 'app-weight-chart',
  imports: [UiEmptyState],
  templateUrl: './weight-chart.html',
  styleUrl: './weight-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-chart' },
})
export class WeightChart {
  /** Vægten uden enhed, fx `'75'` eller `'74,5'`. */
  readonly weightText = input.required<string>();
  /** Kurvens punkter i kg, ældste først. */
  readonly seriesKg = input.required<readonly number[]>();
  readonly goalWeightKg = input.required<number>();
  readonly goalWeightText = input.required<string>();
  /** `'Sidste 4 uger'`. */
  readonly rangeLabel = input.required<string>();
  /** `'-4 uger'` – fodnotens venstre etiket. */
  readonly rangeStartLabel = input.required<string>();
  /** `'−2,6 kg'`. */
  readonly deltaText = input.required<string>();
  readonly deltaTone = input.required<WeightChangeTone>();

  protected readonly width = WEIGHT_CHART_WIDTH;
  protected readonly height = WEIGHT_CHART_HEIGHT;
  protected readonly viewBox = `0 0 ${WEIGHT_CHART_WIDTH} ${WEIGHT_CHART_HEIGHT}`;

  protected readonly geometry = computed(() =>
    computeWeightChartGeometry(this.seriesKg(), this.goalWeightKg()),
  );
  protected readonly hasSeries = computed(() => this.geometry().linePath !== '');
  protected readonly chartLabel = computed(
    () => `Vægtudvikling, ${this.rangeLabel().toLowerCase()}: ${this.deltaText()}`,
  );
  protected readonly deltaClass = computed(() => `weight-chart__delta--${this.deltaTone()}`);
}
