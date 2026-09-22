import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GOALS, GOAL_WEIGHT_MIN_KG } from '../../../../../core/constants/nutrition';
import { GoalId } from '../../../../../core/models/profile';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

/** Designets `goalsDef`: glyffen til højre og dens faste farve pr. mål. */
interface GoalOption {
  readonly id: GoalId;
  readonly label: string;
  readonly description: string;
  readonly glyph: string;
  readonly glyphClass: string;
}

const GOAL_GLYPHS: Readonly<Record<GoalId, string>> = { tabe: '↓', hold: '=', tage: '↑' };
const GOAL_GLYPH_CLASSES: Readonly<Record<GoalId, string>> = {
  tabe: 'goal-step__glyph--accent',
  hold: 'goal-step__glyph--muted',
  tage: 'goal-step__glyph--selected',
};

/** Designets startforslag til målvægten, når man vælger et mål (`goalsDef[].pick`). */
const GOAL_WEIGHT_OFFSET_KG = 5;

/**
 * Trin `goal` (designets `s4`): tabe / holde / tage på. Valget nulstiller tempoet og
 * sætter et startforslag til målvægten, præcis som designet gør.
 */
@Component({
  selector: 'app-goal-step',
  imports: [UiOptionCard],
  templateUrl: './goal-step.html',
  styleUrl: './goal-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'goal-step' },
})
export class GoalStep {
  protected readonly state = inject(SignupStateService);

  protected readonly options: readonly GoalOption[] = GOALS.map((goal) => ({
    id: goal.id,
    label: goal.label,
    description: goal.description,
    glyph: GOAL_GLYPHS[goal.id],
    glyphClass: GOAL_GLYPH_CLASSES[goal.id],
  }));

  protected select(id: GoalId): void {
    this.state.goal.set(id);
    this.state.pace.set(null);
    this.state.goalWeightKg.set(this.suggestedGoalWeight(id));
  }

  /** `tabe` → 5 kg under (dog mindst 35), `tage` → 5 kg over, `hold` → vægten i dag. */
  private suggestedGoalWeight(id: GoalId): number {
    const current = Math.round(this.state.weightKg());
    switch (id) {
      case 'tabe':
        return Math.max(GOAL_WEIGHT_MIN_KG, current - GOAL_WEIGHT_OFFSET_KG);
      case 'tage':
        return current + GOAL_WEIGHT_OFFSET_KG;
      default:
        return current;
    }
  }
}
