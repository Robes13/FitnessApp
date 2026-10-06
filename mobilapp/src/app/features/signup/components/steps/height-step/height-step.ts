import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM } from '../../../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { formatDecimal, formatWeightKg } from '../../../../../core/utils/date-format';
import { injectTranslate } from '../../../../../core/services/language/translate';
import { MeasureStage } from '../../measure-stage/measure-stage';

import { SignupStateService } from '../../../services/signup-state';

/**
 * Step 5 (`s3`): height as a large orange number with a ruler from 100 to 250 cm.
 * The BMI below the buttons updates immediately, and the figure approaches the ceiling
 * from 212 cm and ducks its head from 230 cm (both handled in `computeFigureGeometry`).
 * The number, buttons, figure and ruler are the shared `MeasureStage`.
 */
@Component({
  selector: 'app-height-step',
  imports: [MeasureStage, TranslatePipe],
  templateUrl: './height-step.html',
  styleUrl: './height-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'height-step' },
})
export class HeightStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);

  protected readonly minCm = HEIGHT_MIN_CM;
  protected readonly maxCm = HEIGHT_MAX_CM;

  protected readonly bmiText = computed(() =>
    formatDecimal(this.calculator.bmi(this.state.weightKg(), this.state.heightCm()), 1),
  );
  protected readonly subtitle = computed(() =>
    this.t('signup.heightStep.subtitle', { weight: formatWeightKg(this.state.weightKg()) }),
  );
}
