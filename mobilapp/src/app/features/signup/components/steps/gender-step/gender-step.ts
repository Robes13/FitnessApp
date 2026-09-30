import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { GENDERS } from '../../../../../core/constants/nutrition';
import { Gender } from '../../../../../core/models/profile';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

/**
 * Step 3 (`sKon`): gender as three option cards with a radio dot. The choice colors the
 * figure's headband on the following steps (`genderBandTone`) and feeds into the BMR formula.
 */
@Component({
  selector: 'app-gender-step',
  imports: [TranslatePipe, UiOptionCard],
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
