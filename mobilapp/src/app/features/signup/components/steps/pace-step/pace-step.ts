import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { PACES } from '../../../../../core/constants/nutrition';
import { PaceId } from '../../../../../core/models/profile';
import { injectTranslate } from '../../../../../core/services/language/translate';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

const INTRO_GAIN_KEY = 'signup.paceStep.introGain';
const INTRO_LOSE_KEY = 'signup.paceStep.introLose';
const SUMMARY_EMPTY_KEY = 'signup.paceStep.summaryEmpty';

/**
 * Step `pace` (the design's `s5`): the tempo of the weight change. The step is skipped when
 * the goal is "maintain weight" (`SKIP_PACE_FOR_MAINTAIN`). The green box at the bottom
 * translates the tempo into a daily calorie figure.
 */
@Component({
  selector: 'app-pace-step',
  imports: [TranslatePipe, UiOptionCard],
  templateUrl: './pace-step.html',
  styleUrl: './pace-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pace-step' },
})
export class PaceStep {
  protected readonly state = inject(SignupStateService);
  private readonly t = injectTranslate();
  protected readonly options = PACES;

  protected readonly intro = computed(() =>
    this.t(this.state.goal() === 'tage' ? INTRO_GAIN_KEY : INTRO_LOSE_KEY),
  );

  protected readonly summary = computed(() => {
    const pace = PACES.find((candidate) => candidate.id === this.state.pace());
    if (!pace) {
      return this.t(SUMMARY_EMPTY_KEY);
    }
    const params = {
      pace: this.t(pace.labelKey),
      rate: this.t(pace.rateLabelKey),
      kcal: pace.kcalPerDay,
    };
    return this.state.goal() === 'tage'
      ? this.t('signup.paceStep.summaryGain', params)
      : this.t('signup.paceStep.summaryLose', params);
  });

  protected select(id: PaceId): void {
    this.state.pace.set(id);
  }
}
