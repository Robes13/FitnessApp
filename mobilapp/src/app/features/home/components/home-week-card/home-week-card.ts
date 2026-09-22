import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCard } from '../../../../shared/components/ui-card/ui-card';
import { WeekSummary } from '../../services/home-summary';

/** "Denne uge": days on target, average kcal, protein hit, and streak – plus a short summary. */
@Component({
  selector: 'app-home-week-card',
  imports: [UiCard],
  templateUrl: './home-week-card.html',
  styleUrl: './home-week-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-week-card' },
})
export class HomeWeekCard {
  readonly summary = input.required<WeekSummary>();
}
