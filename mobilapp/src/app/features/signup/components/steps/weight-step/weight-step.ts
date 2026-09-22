import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../../../core/constants/nutrition';
import { formatWeightKg } from '../../../../../core/utils/date-format';
import { Figure, bandToneForGender } from '../../../../../shared/components/figure';
import { RULER_BLEED_IDLE_STRONG } from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';

import { SignupStateService } from '../../../services/signup-state';

/** Designets `wMinus`/`wPlus`: ét kilo ad gangen. */
const STEP_KG = 1;
const FIGURE_LABEL = 'Figur med håndvægt';

/**
 * Trin 4 (`s2`): vægten som et stort orange tal med en lineal fra 30 til 300 kg.
 * Figuren ved siden af bliver bredere, når vægten stiger (`computeFigureGeometry`),
 * og løfter en håndvægt.
 */
@Component({
  selector: 'app-weight-step',
  imports: [Figure, UiRuler],
  templateUrl: './weight-step.html',
  styleUrl: './weight-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-step' },
})
export class WeightStep {
  protected readonly state = inject(SignupStateService);

  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly minKg = WEIGHT_MIN_KG;
  protected readonly maxKg = WEIGHT_MAX_KG;
  protected readonly figureLabel = FIGURE_LABEL;

  protected readonly weightText = computed(() => formatWeightKg(this.state.weightKg()));
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  protected adjust(delta: number): void {
    this.state.weightKg.update((kg) =>
      Math.min(this.maxKg, Math.max(this.minKg, kg + delta * STEP_KG)),
    );
  }
}
