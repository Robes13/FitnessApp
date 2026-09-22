import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCard } from '../../../../shared/components/ui-card/ui-card';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { GoalSummary } from '../../services/home-summary';

/**
 * Det orange "Til mål"-kort: afstand til målvægten, selve målvægten, fremdrift og en kort
 * vejledning ud fra det valgte tempo. Siden skjuler kortet, når målet er at holde vægten.
 */
@Component({
  selector: 'app-home-goal-card',
  imports: [UiCard, UiProgressBar],
  templateUrl: './home-goal-card.html',
  styleUrl: './home-goal-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-goal-card' },
})
export class HomeGoalCard {
  readonly summary = input.required<GoalSummary>();
}
