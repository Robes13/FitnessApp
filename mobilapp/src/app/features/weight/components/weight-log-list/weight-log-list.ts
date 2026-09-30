import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WEIGHT_LOG_LIST_TEXT_KEY } from '../../../../core/constants/weight';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { WeighLogRow } from '../../services/weight-view';

/**
 * "Recent weigh-ins": date, time, difference from the previous weigh-in and the weight. Each row
 * is a button that asks the parent to edit that weigh-in; "Vis alle" / "Vis færre" toggles
 * between the newest rows and every weigh-in from the last 3 months.
 */
@Component({
  selector: 'app-weight-log-list',
  imports: [TranslatePipe, UiButton, UiEmptyState],
  templateUrl: './weight-log-list.html',
  styleUrl: './weight-log-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-log-list' },
})
export class WeightLogList {
  readonly rows = input.required<readonly WeighLogRow[]>();
  /** Rows left out while collapsed; 0 (with `expanded` false) hides the toggle. */
  readonly hiddenCount = input(0);
  readonly expanded = input(false);
  readonly emptyMessage = input.required<string>();

  readonly rowSelected = output<string>();
  readonly expandToggled = output<void>();

  private readonly t = injectTranslate();

  protected readonly showToggle = computed(() => this.expanded() || this.hiddenCount() > 0);
  protected readonly toggleLabel = computed(() =>
    this.expanded()
      ? this.t(WEIGHT_LOG_LIST_TEXT_KEY.showFewer)
      : this.t(WEIGHT_LOG_LIST_TEXT_KEY.showAll, { hiddenCount: this.hiddenCount() }),
  );

  protected rowLabel(row: WeighLogRow): string {
    const { date, time, kg } = row;
    return this.t(WEIGHT_LOG_LIST_TEXT_KEY.editRow, { date, time, kg });
  }
}
