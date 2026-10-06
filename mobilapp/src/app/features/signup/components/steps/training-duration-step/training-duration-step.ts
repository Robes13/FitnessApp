import { FigureTempo } from '../../../../../shared/components/figure';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { injectTranslate } from '../../../../../core/services/language/translate';
import {
  TRAINING_MAX_MINUTES,
  TRAINING_MIN_MINUTES,
} from '../../../../../core/constants/nutrition';
import { clamp, roundTo } from '../../../../../core/utils/math';
import {
  FigureBody,
  FigureExpression,
  animatedFigure,
  bandToneForGender,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';

/** The design's `durLabel`/`durSubtitle` thresholds in minutes. */
const SHORT_MAX_MINUTES = 25;
const CLASSIC_MAX_MINUTES = 50;
const LONG_MAX_MINUTES = 80;
const VERY_LONG_MAX_MINUTES = 120;

const LABEL_SHORT_KEY = 'signup.trainingDurationStep.labelShort';
const LABEL_CLASSIC_KEY = 'signup.trainingDurationStep.labelClassic';
const LABEL_LONG_KEY = 'signup.trainingDurationStep.labelLong';
const LABEL_VERY_LONG_KEY = 'signup.trainingDurationStep.labelVeryLong';
const LABEL_ENDURANCE_KEY = 'signup.trainingDurationStep.labelEndurance';

const SUBTITLE_SHORT_KEY = 'signup.trainingDurationStep.subtitleShort';
const SUBTITLE_CLASSIC_KEY = 'signup.trainingDurationStep.subtitleClassic';
const SUBTITLE_LONG_KEY = 'signup.trainingDurationStep.subtitleLong';
const SUBTITLE_VERY_LONG_KEY = 'signup.trainingDurationStep.subtitleVeryLong';
const SUBTITLE_ENDURANCE_KEY = 'signup.trainingDurationStep.subtitleEndurance';

/** The stopwatch ring: the full circumference of the circle with r = 58 (the design's `364.4`). */
const DIAL_CIRCUMFERENCE = 364.4;
/** Hand speed in seconds: faster the longer the session is (the design's `sweepDur`). */
const SWEEP_BASE_DURATION_S = 4.5;
const SWEEP_MIN_DURATION_S = 1.2;
const SWEEP_DIVISOR = 40;
/** The figure's bob has a fixed tempo here. */
const BOB_DURATION_S = 1.6;
/** The design's `dfig`: the figure is happy at this step. */
const FIGURE_MOOD = 0.5;

const RULER_STEP = 5;

/**
 * Step 8: how long do you train per session?
 *
 * The minute value fills the stopwatch ring (0–180 min) and sets the hand's speed. The
 * figure is `FigureBody` scaled down to 62%, as in the design — without cheeks, because
 * the stopwatch scene draws a calm face.
 */
@Component({
  selector: 'app-training-duration-step',
  imports: [FigureTempo, FigureBody, TranslatePipe, UiRuler],
  templateUrl: './training-duration-step.html',
  styleUrl: './training-duration-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'training-duration-step' },
})
export class TrainingDurationStep {
  protected readonly state = inject(SignupStateService);
  private readonly t = injectTranslate();

  protected readonly rulerMin = TRAINING_MIN_MINUTES;
  protected readonly rulerMax = TRAINING_MAX_MINUTES;
  protected readonly rulerStep = RULER_STEP;
  protected readonly dialCircumference = DIAL_CIRCUMFERENCE;
  protected readonly bobDuration = BOB_DURATION_S;
  /** The stopwatch figure has no cheeks in the design. */
  protected readonly expression: Partial<FigureExpression> = { cheekRadius: 0 };

  protected readonly minutes = computed(() =>
    clamp(this.state.trainingMinutes(), TRAINING_MIN_MINUTES, TRAINING_MAX_MINUTES),
  );
  protected readonly minutesText = computed(() => String(this.minutes()));

  protected readonly label = computed(() => this.t(this.labelKey()));

  private readonly labelKey = computed(() => {
    const minutes = this.minutes();
    if (minutes < SHORT_MAX_MINUTES) {
      return LABEL_SHORT_KEY;
    }
    if (minutes < CLASSIC_MAX_MINUTES) {
      return LABEL_CLASSIC_KEY;
    }
    if (minutes < LONG_MAX_MINUTES) {
      return LABEL_LONG_KEY;
    }
    return minutes < VERY_LONG_MAX_MINUTES ? LABEL_VERY_LONG_KEY : LABEL_ENDURANCE_KEY;
  });

  protected readonly subtitle = computed(() => this.t(this.subtitleKey()));

  private readonly subtitleKey = computed(() => {
    const minutes = this.minutes();
    if (minutes < SHORT_MAX_MINUTES) {
      return SUBTITLE_SHORT_KEY;
    }
    if (minutes < CLASSIC_MAX_MINUTES) {
      return SUBTITLE_CLASSIC_KEY;
    }
    if (minutes < LONG_MAX_MINUTES) {
      return SUBTITLE_LONG_KEY;
    }
    return minutes < VERY_LONG_MAX_MINUTES ? SUBTITLE_VERY_LONG_KEY : SUBTITLE_ENDURANCE_KEY;
  });

  /** The ring's remaining stroke amount – 0 at 180 minutes. */
  protected readonly arcOffset = computed(() =>
    roundTo(DIAL_CIRCUMFERENCE * (1 - this.minutes() / TRAINING_MAX_MINUTES), 1),
  );

  protected readonly sweepDuration = computed(() =>
    roundTo(
      Math.max(SWEEP_MIN_DURATION_S, SWEEP_BASE_DURATION_S - this.minutes() / SWEEP_DIVISOR),
      2,
    ),
  );

  protected readonly figure = animatedFigure(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm(), FIGURE_MOOD),
  );

  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
}
