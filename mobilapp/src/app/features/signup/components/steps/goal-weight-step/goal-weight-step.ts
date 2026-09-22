import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator';
import { formatDecimal, formatWeightKg } from '../../../../../core/utils/date-format';
import {
  FigureBody,
  bandToneForGender,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';

/**
 * Designets faste mål fra skærmen (HTML-linje 782–800). De er ikke spacing-tokens, men
 * geometri for scenen, og bindes derfor som CSS-variabler — som i `BarcodeScanner`.
 */
const GOAL_WEIGHT_LAYOUT = { quipWidth: 290, asideWidth: 150, figureWidth: 215 } as const;

/** Figurens humør ved målvægten: lidt gladere når man vil ned, end når man vil op. */
const MOOD_GAIN = 0.4;
const MOOD_OTHER = 0.6;

const SAME_AS_NOW = 'Samme som nu';
const HINT_TOO_LOW = 'Det mål er for lavt for din højde.';
const HINT_TOO_HIGH = 'Det mål er meget højt for din højde.';
const MINUS_SIGN = '−';
const PLUS_SIGN = '+';

/**
 * Trin `goal-weight` (designets `sMaal`): målvægten vælges på en lineal, hvis grænser
 * følger målet (`NutritionCalculator.goalWeightBounds`). Figuren tegnes ved målvægten oven
 * på en stiplet silhuet af kroppen i dag, så forskellen kan ses.
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

  /** Designets `goalW`: kladdens værdi klemt ind i skalaens grænser. */
  protected readonly goalWeightKg = computed(() => {
    const { min, max } = this.bounds();
    return Math.min(max, Math.max(min, this.state.goalWeightKg()));
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

  /** Tom, når målet er realistisk – ellers designets to advarsler. */
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

  protected readonly goalGeometry = computed(() =>
    computeFigureGeometry(
      this.goalWeightKg(),
      this.state.heightCm(),
      this.state.goal() === 'tage' ? MOOD_GAIN : MOOD_OTHER,
    ),
  );
  /** Kroppen i dag – tegnes som stiplet omrids bag figuren. */
  protected readonly currentGeometry = computed(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm()),
  );
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
}
