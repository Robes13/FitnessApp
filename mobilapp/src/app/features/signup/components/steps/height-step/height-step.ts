import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM } from '../../../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { formatDecimal, formatWeightKg } from '../../../../../core/utils/date-format';
import { Figure, bandToneForGender } from '../../../../../shared/components/figure';
import { RULER_BLEED_IDLE_STRONG } from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { clamp } from '../../../../../core/utils/math';
import { injectTranslate } from '../../../../../core/services/language/translate';

import { SignupStateService } from '../../../services/signup-state';

/** The design's `hMinus`/`hPlus`: one centimeter at a time. */
const STEP_CM = 1;

/**
 * Step 5 (`s3`): height as a large orange number with a ruler from 100 to 250 cm.
 * The BMI below the buttons updates immediately, and the figure approaches the ceiling
 * from 212 cm and ducks its head from 230 cm (both handled in `computeFigureGeometry`).
 */
@Component({
  selector: 'app-height-step',
  imports: [Figure, TranslatePipe, UiRuler],
  templateUrl: './height-step.html',
  styleUrl: './height-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'height-step' },
})
export class HeightStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);

  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly minCm = HEIGHT_MIN_CM;
  protected readonly maxCm = HEIGHT_MAX_CM;

  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
  protected readonly bmiText = computed(() =>
    formatDecimal(this.calculator.bmi(this.state.weightKg(), this.state.heightCm()), 1),
  );
  protected readonly subtitle = computed(() =>
    this.t('signup.heightStep.subtitle', { weight: formatWeightKg(this.state.weightKg()) }),
  );

  protected adjust(delta: number): void {
    this.state.heightCm.update((cm) => clamp(cm + delta * STEP_CM, this.minCm, this.maxCm));
  }
}
