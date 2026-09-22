import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { WeighLogRow } from '../../services/weight-view';

/** "Seneste vejninger": dato, klokkeslæt, forskel til forrige vejning og vægten. */
@Component({
  selector: 'app-weight-log-list',
  imports: [UiEmptyState],
  templateUrl: './weight-log-list.html',
  styleUrl: './weight-log-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-log-list' },
})
export class WeightLogList {
  readonly rows = input.required<readonly WeighLogRow[]>();
}
