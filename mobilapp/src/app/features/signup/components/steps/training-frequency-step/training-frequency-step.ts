import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Gender } from '../../../../../core/models/profile';
import { DAY_LETTERS, DAY_NAMES_LONG } from '../../../../../core/utils/date-format';
import {
  FigureBandTone,
  FigureBody,
  FigureGeometry,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { SignupStateService } from '../../../services/signup-state';

/** Designets `freqLabel`/`freqSubtitle`-tærskler. */
const LIGHT_MAX_DAYS = 2;
const GOOD_MAX_DAYS = 4;
const HIGH_MAX_DAYS = 6;
/** Fra seks træninger om ugen sveder figuren. */
const SWEAT_MIN_DAYS = 6;

const LABEL_NONE = 'Ingen faste træninger';
const LABEL_LIGHT = 'Let rytme';
const LABEL_GOOD = 'God rytme';
const LABEL_HIGH = 'Høj frekvens';
const LABEL_DAILY = 'Hver dag';

const SUBTITLE_NONE = 'Så regner vi kun med dine skridt. Du kan altid ændre det senere.';
const SUBTITLE_LIGHT = 'En eller to gange om ugen holder maskinen i gang.';
const SUBTITLE_GOOD = 'Det niveau de fleste kan holde året rundt.';
const SUBTITLE_HIGH = 'Mange pas om ugen. Husk en hviledag imellem.';

/** Curl-tempoet (designets `curlDur`): langsommere jo færre træninger. */
const CURL_IDLE_DURATION_S = 1.6;
const CURL_BASE_DURATION_S = 1.8;
const CURL_MIN_DURATION_S = 0.6;
const CURL_STEP_PER_DAY_S = 0.16;

/** Figurens humør, når der er mindst én træning (designets `ffig`). */
const TRAINING_MOOD = 0.6;
const SWEAT_DURATION_S = 1.2;

interface DayToggle {
  readonly index: number;
  readonly label: string;
  readonly name: string;
  readonly selected: boolean;
}

interface SweatDrop {
  readonly path: string;
  readonly duration: number;
  readonly delay: number;
}

function dropPath(x: number, y: number): string {
  return `M${x} ${y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

function bandToneFor(gender: Gender | null): FigureBandTone {
  if (gender === 'kvinde') {
    return 'pink';
  }
  return gender === 'andet' ? 'white' : 'accent';
}

/**
 * Trin 7: hvor mange dage om ugen træner du?
 *
 * Dagene vælges enkeltvis (mandag først), og antallet styrer både teksten og figurens
 * biceps-curl: uden træningsdage står den stille, og fra seks dage kommer der sved.
 * Kroppen er `FigureBody`; kun højre arm og håndvægten tegnes her, fordi de skal rotere
 * om skulderen i deres egen gruppe.
 */
@Component({
  selector: 'app-training-frequency-step',
  imports: [FigureBody],
  templateUrl: './training-frequency-step.html',
  styleUrl: './training-frequency-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'training-frequency-step' },
})
export class TrainingFrequencyStep {
  protected readonly state = inject(SignupStateService);

  protected readonly frequency = computed(() => this.state.trainingDays().filter(Boolean).length);
  protected readonly frequencyText = computed(() => String(this.frequency()));

  protected readonly label = computed(() => {
    const days = this.frequency();
    if (days === 0) {
      return LABEL_NONE;
    }
    if (days <= LIGHT_MAX_DAYS) {
      return LABEL_LIGHT;
    }
    if (days <= GOOD_MAX_DAYS) {
      return LABEL_GOOD;
    }
    return days <= HIGH_MAX_DAYS ? LABEL_HIGH : LABEL_DAILY;
  });

  protected readonly subtitle = computed(() => {
    const days = this.frequency();
    if (days === 0) {
      return SUBTITLE_NONE;
    }
    if (days <= LIGHT_MAX_DAYS) {
      return SUBTITLE_LIGHT;
    }
    return days <= GOOD_MAX_DAYS ? SUBTITLE_GOOD : SUBTITLE_HIGH;
  });

  protected readonly days = computed<readonly DayToggle[]>(() => {
    const selected = this.state.trainingDays();
    return DAY_LETTERS.map((letter, index) => ({
      index,
      label: letter,
      name: DAY_NAMES_LONG[index] ?? letter,
      selected: selected[index] === true,
    }));
  });

  protected readonly figure = computed<FigureGeometry>(() =>
    computeFigureGeometry(
      this.state.weightKg(),
      this.state.heightCm(),
      this.frequency() === 0 ? 0 : TRAINING_MOOD,
    ),
  );

  protected readonly bandTone = computed(() => bandToneFor(this.state.gender()));

  /** Curl-gruppens omdrejningspunkt: højre skulder. */
  protected readonly curlOrigin = computed(() => {
    const g = this.figure();
    return `${g.bodyX + g.bodyW - 10}px ${g.bodyY + 22}px`;
  });

  protected readonly curlDuration = computed(() => {
    const days = this.frequency();
    if (days === 0) {
      return CURL_IDLE_DURATION_S;
    }
    // Designet skriver varigheden med to decimaler.
    const duration = Math.max(
      CURL_MIN_DURATION_S,
      CURL_BASE_DURATION_S - days * CURL_STEP_PER_DAY_S,
    );
    return Math.round(duration * 100) / 100;
  });
  protected readonly curlPlayState = computed(() =>
    this.frequency() === 0 ? 'paused' : 'running',
  );

  protected readonly sweat = computed<readonly SweatDrop[]>(() => {
    if (this.frequency() < SWEAT_MIN_DAYS) {
      return [];
    }
    const headY = Math.round(this.figure().headY - 18);
    return [{ path: dropPath(72, headY), duration: SWEAT_DURATION_S, delay: 0 }];
  });
}
