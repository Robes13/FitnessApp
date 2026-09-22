import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { UiCard } from '../../../../shared/components/ui-card/ui-card';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { GoalSummary } from '../../services/home-summary';

/**
 * The orange "Til mål" card: distance to the goal weight, the goal weight itself,
 * progress, and a short pointer based on the chosen pace. The page hides the card when
 * the goal is to maintain weight.
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
