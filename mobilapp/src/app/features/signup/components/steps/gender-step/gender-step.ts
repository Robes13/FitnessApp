import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { GENDERS } from '../../../../../core/constants/nutrition';
import { Gender } from '../../../../../core/models/profile';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

/**
 * Trin 3 (`sKon`): køn som tre valgkort med radio-prik. Valget farver figurens
 * pandebånd på de følgende trin (`genderBandTone`) og indgår i BMR-formlen.
 */
@Component({
  selector: 'app-gender-step',
  imports: [UiOptionCard],
  templateUrl: './gender-step.html',
  styleUrl: './gender-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'gender-step' },
})
export class GenderStep {
  protected readonly state = inject(SignupStateService);
  protected readonly genders = GENDERS;

  protected select(gender: Gender): void {
    this.state.gender.set(gender);
  }
}
