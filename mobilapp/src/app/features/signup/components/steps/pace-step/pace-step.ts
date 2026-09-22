import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { PACES } from '../../../../../core/constants/nutrition';
import { PaceId } from '../../../../../core/models/profile';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

const INTRO_GAIN = 'Hvor hurtigt vil du tage på?';
const INTRO_LOSE = 'Hvor hurtigt vil du tabe dig?';
const SUMMARY_EMPTY = 'Vælg et tempo for at se dagligt kalorietal.';

/**
 * Step `pace` (the design's `s5`): the tempo of the weight change. The step is skipped when
 * the goal is "maintain weight" (`SKIP_PACE_FOR_MAINTAIN`). The green box at the bottom
 * translates the tempo into a daily calorie figure.
 */
@Component({
  selector: 'app-pace-step',
  imports: [UiOptionCard],
  templateUrl: './pace-step.html',
  styleUrl: './pace-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pace-step' },
})
export class PaceStep {
  protected readonly state = inject(SignupStateService);
  protected readonly options = PACES;

  protected readonly intro = computed(() =>
    this.state.goal() === 'tage' ? INTRO_GAIN : INTRO_LOSE,
  );

  protected readonly summary = computed(() => {
    const pace = PACES.find((candidate) => candidate.id === this.state.pace());
    if (!pace) {
      return SUMMARY_EMPTY;
    }
    const direction = this.state.goal() === 'tage' ? 'ekstra' : 'mindre';
    return `${pace.label} · ${pace.rateLabel} svarer til ca. ${pace.kcalPerDay} kcal ${direction} om dagen.`;
  });

  protected select(id: PaceId): void {
    this.state.pace.set(id);
  }
}
