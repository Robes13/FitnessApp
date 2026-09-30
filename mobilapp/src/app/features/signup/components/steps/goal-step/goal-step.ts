import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GOALS, GOAL_WEIGHT_MIN_KG } from '../../../../../core/constants/nutrition';
import { GoalId } from '../../../../../core/models/profile';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

/** Design's `goalsDef`: the glyph on the right and its fixed color per goal. */
interface GoalOption {
  readonly id: GoalId;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly glyph: string;
  readonly glyphClass: string;
}

const GOAL_GLYPHS: Readonly<Record<GoalId, string>> = { tabe: '↓', hold: '=', tage: '↑' };
const GOAL_GLYPH_CLASSES: Readonly<Record<GoalId, string>> = {
  tabe: 'goal-step__glyph--accent',
  hold: 'goal-step__glyph--muted',
  tage: 'goal-step__glyph--selected',
};

/** Design's initial suggestion for the goal weight when picking a goal (`goalsDef[].pick`). */
const GOAL_WEIGHT_OFFSET_KG = 5;

/**
 * Step `goal` (design's `s4`): lose / maintain / gain. The choice resets the pace and
 * sets an initial suggestion for the goal weight, exactly as the design does.
 */
@Component({
  selector: 'app-goal-step',
  imports: [TranslatePipe, UiOptionCard],
  templateUrl: './goal-step.html',
  styleUrl: './goal-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'goal-step' },
})
export class GoalStep {
  protected readonly state = inject(SignupStateService);

  protected readonly options: readonly GoalOption[] = GOALS.map((goal) => ({
    id: goal.id,
    labelKey: goal.labelKey,
    descriptionKey: goal.descriptionKey,
    glyph: GOAL_GLYPHS[goal.id],
    glyphClass: GOAL_GLYPH_CLASSES[goal.id],
  }));

  protected select(id: GoalId): void {
    this.state.goal.set(id);
    this.state.pace.set(null);
    this.state.goalWeightKg.set(this.suggestedGoalWeight(id));
  }

  /** `tabe` → 5 kg below (but at least 35), `tage` → 5 kg above, `hold` → today's weight. */
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
