import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCard } from '../../../../shared/components/ui-card/ui-card';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { DaySummary } from '../../services/home-summary';

/**
 * Kortet for den valgte dag: titel, fremdriftsbjælke, kalorier og vægt samt de tre
 * makrobjælker. Dage der ikke er kommet endnu viser `–` og tomme bjælker.
 */
@Component({
  selector: 'app-home-day-card',
  imports: [UiCard, UiProgressBar],
  templateUrl: './home-day-card.html',
  styleUrl: './home-day-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-day-card' },
})
export class HomeDayCard {
  readonly summary = input.required<DaySummary>();
}
