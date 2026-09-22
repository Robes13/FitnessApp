import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  TRAINING_MAX_MINUTES,
  TRAINING_MIN_MINUTES,
} from '../../../../../core/constants/nutrition';
import { Gender } from '../../../../../core/models/profile';
import {
  FigureBandTone,
  FigureBody,
  FigureExpression,
  FigureGeometry,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';

/** Designets `durLabel`/`durSubtitle`-tærskler i minutter. */
const SHORT_MAX_MINUTES = 25;
const CLASSIC_MAX_MINUTES = 50;
const LONG_MAX_MINUTES = 80;
const VERY_LONG_MAX_MINUTES = 120;

const LABEL_SHORT = 'Kort og effektivt';
const LABEL_CLASSIC = 'Klassisk pas';
const LABEL_LONG = 'Lang session';
const LABEL_VERY_LONG = 'Rigtig lang session';
const LABEL_ENDURANCE = 'Udholdenhedspas';

const SUBTITLE_SHORT = 'Kort, men det tæller. Bedre end intet.';
const SUBTITLE_CLASSIC = 'Den længde de fleste kan få til at passe ind.';
const SUBTITLE_LONG = 'Godt med tid til både opvarmning og styrke.';
const SUBTITLE_VERY_LONG = 'Lange pas kræver mad og væske undervejs.';
const SUBTITLE_ENDURANCE = 'Over to timer. Planlæg mad, væske og en rolig dag efter.';

/** Stopurets ring: hele omkredsen af cirklen med r = 58 (designets `364.4`). */
const DIAL_CIRCUMFERENCE = 364.4;
/** Visersekunder: hurtigere jo længere passet er (designets `sweepDur`). */
const SWEEP_BASE_DURATION_S = 4.5;
const SWEEP_MIN_DURATION_S = 1.2;
const SWEEP_DIVISOR = 40;
/** Figurens vip har fast tempo her. */
const BOB_DURATION_S = 1.6;
/** Designets `dfig`: figuren er glad på dette trin. */
const FIGURE_MOOD = 0.5;

const RULER_STEP = 5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Designet skriver buen med én og varigheden med to decimaler. */
function round(value: number, factor: number): number {
  return Math.round(value * factor) / factor;
}

function bandToneFor(gender: Gender | null): FigureBandTone {
  if (gender === 'kvinde') {
    return 'pink';
  }
  return gender === 'andet' ? 'white' : 'accent';
}

/**
 * Trin 8: hvor længe træner du ad gangen?
 *
 * Minuttallet fylder stopurets ring (0–180 min) og sætter farten på viseren. Figuren er
 * `FigureBody` skaleret ned til 62 %, som i designet – uden kinder, fordi stopur-scenen
 * tegner et roligt ansigt.
 */
@Component({
  selector: 'app-training-duration-step',
  imports: [FigureBody, UiRuler],
  templateUrl: './training-duration-step.html',
  styleUrl: './training-duration-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'training-duration-step' },
})
export class TrainingDurationStep {
  protected readonly state = inject(SignupStateService);

  protected readonly rulerMin = TRAINING_MIN_MINUTES;
  protected readonly rulerMax = TRAINING_MAX_MINUTES;
  protected readonly rulerStep = RULER_STEP;
  protected readonly dialCircumference = DIAL_CIRCUMFERENCE;
  protected readonly bobDuration = BOB_DURATION_S;
  /** Stopur-figuren har ingen kinder i designet. */
  protected readonly expression: Partial<FigureExpression> = { cheekRadius: 0 };

  protected readonly dragging = signal(false);

  protected readonly minutes = computed(() =>
    clamp(this.state.trainingMinutes(), TRAINING_MIN_MINUTES, TRAINING_MAX_MINUTES),
  );
  protected readonly minutesText = computed(() => String(this.minutes()));

  protected readonly label = computed(() => {
    const minutes = this.minutes();
    if (minutes < SHORT_MAX_MINUTES) {
      return LABEL_SHORT;
    }
    if (minutes < CLASSIC_MAX_MINUTES) {
      return LABEL_CLASSIC;
    }
    if (minutes < LONG_MAX_MINUTES) {
      return LABEL_LONG;
    }
    return minutes < VERY_LONG_MAX_MINUTES ? LABEL_VERY_LONG : LABEL_ENDURANCE;
  });

  protected readonly subtitle = computed(() => {
    const minutes = this.minutes();
    if (minutes < SHORT_MAX_MINUTES) {
      return SUBTITLE_SHORT;
    }
    if (minutes < CLASSIC_MAX_MINUTES) {
      return SUBTITLE_CLASSIC;
    }
    if (minutes < LONG_MAX_MINUTES) {
      return SUBTITLE_LONG;
    }
    return minutes < VERY_LONG_MAX_MINUTES ? SUBTITLE_VERY_LONG : SUBTITLE_ENDURANCE;
  });

  /** Ringens resterende stregmængde – 0 ved 180 minutter. */
  protected readonly arcOffset = computed(() =>
    round(DIAL_CIRCUMFERENCE * (1 - this.minutes() / TRAINING_MAX_MINUTES), 10),
  );

  protected readonly sweepDuration = computed(() =>
    round(
      Math.max(SWEEP_MIN_DURATION_S, SWEEP_BASE_DURATION_S - this.minutes() / SWEEP_DIVISOR),
      100,
    ),
  );

  protected readonly figure = computed<FigureGeometry>(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm(), FIGURE_MOOD),
  );

  protected readonly bandTone = computed(() => bandToneFor(this.state.gender()));
}
