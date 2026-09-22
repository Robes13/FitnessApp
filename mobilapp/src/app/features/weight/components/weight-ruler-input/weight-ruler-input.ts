import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../../core/constants/nutrition';
import { clamp, roundTo } from '../../../../core/utils/math';
import { RULER_BLEED_IDLE_STRONG } from '../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../shared/components/ui-ruler/ui-ruler';
import { WEIGHT_STEP_KG } from '../../services/weight-view';

/**
 * The weight ruler (30–300 kg in steps of 0.1) with −/+ buttons on top of its ends. Used both
 * for recording a weigh-in on the page and for correcting one in the edit sheet.
 *
 * Every change – dragging or a −/+ step – is emitted as `valueChange` with the new weight,
 * clamped and rounded to 0.1 kg. The parent owns the value.
 */
@Component({
  selector: 'app-weight-ruler-input',
  imports: [UiRuler],
  templateUrl: './weight-ruler-input.html',
  styleUrl: './weight-ruler-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'weight-ruler-input' },
})
export class WeightRulerInput {
  readonly value = input.required<number>();
  readonly valueChange = output<number>();

  protected readonly minKg = WEIGHT_MIN_KG;
  protected readonly maxKg = WEIGHT_MAX_KG;
  protected readonly stepKg = WEIGHT_STEP_KG;
  protected readonly glowStrength = RULER_BLEED_IDLE_STRONG;

  protected step(direction: number): void {
    this.emit(this.value() + direction * WEIGHT_STEP_KG);
  }

  protected emit(kg: number): void {
    this.valueChange.emit(roundTo(clamp(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG), 1));
  }
}
