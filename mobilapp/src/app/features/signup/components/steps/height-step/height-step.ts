import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { HEIGHT_MAX_CM, HEIGHT_MIN_CM } from '../../../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator';
import { formatDecimal, formatWeightKg } from '../../../../../core/utils/date-format';
import { Figure, bandToneForGender } from '../../../../../shared/components/figure';
import { RULER_BLEED_IDLE_STRONG } from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { clamp } from '../../../../../core/utils/math';

import { SignupStateService } from '../../../services/signup-state';

/** Designets `hMinus`/`hPlus`: én centimeter ad gangen. */
const STEP_CM = 1;
const FIGURE_LABEL = 'Figur under loftet';

/**
 * Trin 5 (`s3`): højden som et stort orange tal med en lineal fra 55 til 250 cm.
 * BMI'et under knapperne opdateres med det samme, og figuren nærmer sig loftet fra
 * 212 cm og dukker hovedet fra 230 cm (begge dele ligger i `computeFigureGeometry`).
 */
@Component({
  selector: 'app-height-step',
  imports: [Figure, UiRuler],
  templateUrl: './height-step.html',
  styleUrl: './height-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'height-step' },
})
export class HeightStep {
  private readonly calculator = inject(NutritionCalculator);

  protected readonly state = inject(SignupStateService);

  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly minCm = HEIGHT_MIN_CM;
  protected readonly maxCm = HEIGHT_MAX_CM;
  protected readonly figureLabel = FIGURE_LABEL;

  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
  protected readonly bmiText = computed(() =>
    formatDecimal(this.calculator.bmi(this.state.weightKg(), this.state.heightCm()), 1),
  );
  protected readonly subtitle = computed(
    () =>
      `Sammen med dine ${formatWeightKg(this.state.weightKg())} kg bruger vi den til dit kaloriebehov.`,
  );

  protected adjust(delta: number): void {
    this.state.heightCm.update((cm) => clamp(cm + delta * STEP_CM, this.minCm, this.maxCm));
  }
}
