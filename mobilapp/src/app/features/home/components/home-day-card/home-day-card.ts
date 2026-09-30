import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiCard } from '../../../../shared/components/ui-card/ui-card';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { DaySummary } from '../../services/home-summary';

/**
 * The card for the selected day: title, progress bar, calories and weight, plus the
 * three macro bars. Days that haven't happened yet show `–` and empty bars.
 */
@Component({
  selector: 'app-home-day-card',
  imports: [UiCard, UiProgressBar, TranslatePipe],
  templateUrl: './home-day-card.html',
  styleUrl: './home-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-day-card' },
})
export class HomeDayCard {
  readonly summary = input.required<DaySummary>();
}
