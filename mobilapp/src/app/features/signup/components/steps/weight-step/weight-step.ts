import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../../../core/constants/nutrition';
import { formatWeightKg } from '../../../../../core/utils/date-format';
import { Figure, bandToneForGender } from '../../../../../shared/components/figure';
import { RULER_BLEED_IDLE_STRONG } from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { clamp } from '../../../../../core/utils/math';

import { SignupStateService } from '../../../services/signup-state';

/** Design's `wMinus`/`wPlus`: one kilo at a time. */
const STEP_KG = 1;

/**
 * Step 4 (`s2`): the weight as a large orange number with a ruler from 30 to 300 kg.
 * The figure next to it gets wider as the weight increases (`computeFigureGeometry`),
 * and lifts a dumbbell.
 */
@Component({
  selector: 'app-weight-step',
  imports: [Figure, TranslatePipe, UiRuler],
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

  protected readonly weightText = computed(() => formatWeightKg(this.state.weightKg()));
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  protected adjust(delta: number): void {
    this.state.weightKg.update((kg) => clamp(kg + delta * STEP_KG, this.minKg, this.maxKg));
  }
}
