import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { formatDecimal, formatWeightKg } from '../../../../../core/utils/date-format';
import {
  FigureBody,
  bandToneForGender,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';
import { clamp } from '../../../../../core/utils/math';

/**
 * The design's fixed measurements from the screen (HTML line 782–800). They are not
 * spacing tokens, but scene geometry, and are therefore bound as CSS variables — as in `BarcodeScanner`.
 */
const GOAL_WEIGHT_LAYOUT = { quipWidth: 290, asideWidth: 150, figureWidth: 215 } as const;

/** The figure's mood at the goal weight: a bit happier when losing than when gaining. */
const MOOD_GAIN = 0.4;
const MOOD_OTHER = 0.6;

const SAME_AS_NOW = 'Samme som nu';
const HINT_TOO_LOW = 'Det mål er for lavt for din højde.';
const HINT_TOO_HIGH = 'Det mål er meget højt for din højde.';
const MINUS_SIGN = '−';
const PLUS_SIGN = '+';

/**
 * Step `goal-weight` (design's `sMaal`): the goal weight is chosen on a ruler whose bounds
 * follow the goal (`NutritionCalculator.goalWeightBounds`). The figure is drawn at the goal weight
 * on top of a dashed silhouette of today's body, so the difference can be seen.
 */
@Component({
  selector: 'app-goal-weight-step',
  imports: [FigureBody, UiRuler],
  templateUrl: './goal-weight-step.html',
  styleUrl: './goal-weight-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'goal-weight-step',
    '[style.--goal-weight-quip-width.px]': 'layout.quipWidth',
    '[style.--goal-weight-aside-width.px]': 'layout.asideWidth',
    '[style.--goal-weight-figure-width.px]': 'layout.figureWidth',
  },
})
export class GoalWeightStep {
  private readonly calculator = inject(NutritionCalculator);

  protected readonly state = inject(SignupStateService);
  protected readonly layout = GOAL_WEIGHT_LAYOUT;

  protected readonly bounds = computed(() =>
    this.calculator.goalWeightBounds(this.state.goal(), this.state.weightKg()),
  );

  /** Design's `goalW`: the draft value clamped into the scale's bounds. */
  protected readonly goalWeightKg = computed(() => {
    const { min, max } = this.bounds();
    return clamp(this.state.goalWeightKg(), min, max);
  });

  protected readonly goalWeightText = computed(() => String(Math.round(this.goalWeightKg())));
  protected readonly currentWeightText = computed(() => formatWeightKg(this.state.weightKg()));

  /** "−5,0 kg fra nu" / "+3,5 kg fra nu" / "Samme som nu". */
  protected readonly deltaLabel = computed(() => {
    const difference = Math.round((this.goalWeightKg() - this.state.weightKg()) * 10) / 10;
    if (difference === 0) {
      return SAME_AS_NOW;
    }
    const sign = difference < 0 ? MINUS_SIGN : PLUS_SIGN;
    return `${sign}${formatDecimal(Math.abs(difference), 1)} kg fra nu`;
  });

  protected readonly quip = computed(() => {
    const current = Math.round(this.state.weightKg());
    return this.state.goal() === 'tage'
      ? `Hvor meget vil du op? Skalaen starter lige over dine ${current} kg.`
      : `Hvor meget vil du ned? Skalaen stopper lige under dine ${current} kg.`;
  });

  /** Empty when the goal is realistic – otherwise one of the design's two warnings. */
  protected readonly hint = computed(() => {
    const realistic = this.calculator.isGoalWeightRealistic(
      this.state.goal(),
      this.goalWeightKg(),
      this.state.heightCm(),
    );
    if (realistic) {
      return '';
    }
    return this.state.goal() === 'tabe' ? HINT_TOO_LOW : HINT_TOO_HIGH;
  });

  protected readonly goalGeometry = animatedFigure(() =>
    computeFigureGeometry(
      this.goalWeightKg(),
      this.state.heightCm(),
      this.state.goal() === 'tage' ? MOOD_GAIN : MOOD_OTHER,
    ),
  );
  /** Today's body – drawn as a dashed outline behind the figure. */
  protected readonly currentGeometry = animatedFigure(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm()),
  );
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
}
