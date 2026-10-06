import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../../../core/constants/nutrition';
import { formatWeightKg } from '../../../../../core/utils/date-format';
import { MeasureStage } from '../../measure-stage/measure-stage';

import { SignupStateService } from '../../../services/signup-state';

/**
 * Step 4 (`s2`): the weight as a large orange number with a ruler from 30 to 300 kg.
 * The figure next to it gets wider as the weight increases (`computeFigureGeometry`),
 * and lifts a dumbbell. The number, buttons, figure and ruler are the shared `MeasureStage`.
 */
@Component({
  selector: 'app-weight-step',
  imports: [MeasureStage, TranslatePipe],
  templateUrl: './weight-step.html',
  styleUrl: './weight-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-step' },
})
export class WeightStep {
  protected readonly state = inject(SignupStateService);

  protected readonly minKg = WEIGHT_MIN_KG;
  protected readonly maxKg = WEIGHT_MAX_KG;

  protected readonly weightText = computed(() => formatWeightKg(this.state.weightKg()));
}
