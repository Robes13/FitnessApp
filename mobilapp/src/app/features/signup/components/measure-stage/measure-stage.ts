import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { clamp } from '../../../../core/utils/math';
import { Figure, bandToneForGender } from '../../../../shared/components/figure';
import { RULER_BLEED_IDLE_STRONG } from '../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../services/signup-state';

/**
 * The shared stage of the weight and height steps: the value as a large orange number with
 * −/+ buttons (one unit at a time), the figure next to it and the ruler under both. What sits
 * under the buttons (hint or BMI block) is projected by the step. The figure reads weight,
 * height and gender from `SignupStateService`.
 */
@Component({
  selector: 'app-measure-stage',
  imports: [Figure, TranslatePipe, UiRuler],
  templateUrl: './measure-stage.html',
  styleUrl: './measure-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MeasureStage {
  protected readonly state = inject(SignupStateService);

  readonly value = model.required<number>();
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  /** The formatted number shown next to the unit. */
  readonly display = input.required<string | number>();
  readonly unitKey = input.required<string>();
  readonly decreaseKey = input.required<string>();
  readonly increaseKey = input.required<string>();
  readonly rulerKey = input.required<string>();
  readonly figureKey = input.required<string>();
  readonly showCeiling = input(false, { transform: booleanAttribute });

  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  protected adjust(delta: number): void {
    this.value.update((value) => clamp(value + delta, this.min(), this.max()));
  }
}
