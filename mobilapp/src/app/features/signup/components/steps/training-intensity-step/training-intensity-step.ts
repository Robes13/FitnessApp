import { FigureTempo } from '../../../../../shared/components/figure';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { INTENSITIES, RPE_MAX, RPE_MIN } from '../../../../../core/constants/nutrition';
import { IntensityId } from '../../../../../core/models/profile';
import { Tone } from '../../../../../core/models/tone';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { clamp } from '../../../../../core/utils/math';
import { injectTranslate } from '../../../../../core/services/language/translate';
import {
  FigureBandTone,
  FigureBody,
  FigureCheekTone,
  FigureExpression,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import { UiOptionCard } from '../../../../../shared/components/ui-option-card/ui-option-card';
import { SignupStateService } from '../../../services/signup-state';

/** The height of the effort bars: the design's `12 + n * 2.8` px. */
const EFFORT_BAR_BASE_HEIGHT = 12;
const EFFORT_BAR_STEP_HEIGHT = 2.8;

const INTRO_UNSELECTED_KEY = 'signup.trainingIntensityStep.introUnselected';
const TALK_TEST_UNSELECTED_KEY = 'signup.trainingIntensityStep.talkTestUnselected';
const CAPTION_UNSELECTED_KEY = 'signup.trainingIntensityStep.captionUnselected';
const CAPTION_SELECTED_KEY = 'signup.trainingIntensityStep.captionSelected';
const HINT_SELECTED_KEY = 'signup.trainingIntensityStep.hintSelected';
const RPE_PLACEHOLDER = '–';

const HEAT_DURATION_S = 2.2;
const HEAT_OFFSET_Y = -34;

/** The scene's expression per intensity – the design's `intDef` fields, used only for the figure. */
interface IntensityScene {
  readonly mood: number;
  readonly bobDuration: number;
  readonly band: FigureBandTone;
  readonly cheekTone: FigureCheekTone;
  readonly cheekRadius: number;
  readonly smileOpacity: number;
  readonly mouthRx: number;
  readonly mouthRy: number;
  readonly tongueRx: number;
  readonly tongueRy: number;
  readonly browRotation: number;
  readonly browOpacity: number;
  readonly heat: number;
  readonly drops: number;
}

const NEUTRAL_SCENE: IntensityScene = {
  mood: 0,
  bobDuration: 2.4,
  band: 'muted',
  cheekTone: 'accent-soft',
  cheekRadius: 3.5,
  smileOpacity: 1,
  mouthRx: 0,
  mouthRy: 0,
  tongueRx: 0,
  tongueRy: 0,
  browRotation: 0,
  browOpacity: 0,
  heat: 0,
  drops: 0,
};

const SCENES: Readonly<Record<IntensityId, IntensityScene>> = {
  mildt: {
    mood: 0.9,
    bobDuration: 1.9,
    band: 'positive',
    cheekTone: 'accent-soft',
    cheekRadius: 3.5,
    smileOpacity: 1,
    mouthRx: 0,
    mouthRy: 0,
    tongueRx: 0,
    tongueRy: 0,
    browRotation: 0,
    browOpacity: 0,
    heat: 0,
    drops: 0,
  },
  moderat: {
    mood: 0.2,
    bobDuration: 1.1,
    band: 'accent',
    cheekTone: 'negative',
    cheekRadius: 4.2,
    smileOpacity: 0,
    mouthRx: 7,
    mouthRy: 5,
    tongueRx: 3.5,
    tongueRy: 2.2,
    browRotation: 8,
    browOpacity: 0.8,
    heat: 0,
    drops: 1,
  },
  haardt: {
    mood: -0.6,
    bobDuration: 0.7,
    band: 'negative',
    cheekTone: 'negative-strong',
    cheekRadius: 5,
    smileOpacity: 0,
    mouthRx: 9,
    mouthRy: 8,
    tongueRx: 5,
    tongueRy: 3.5,
    browRotation: 20,
    browOpacity: 1,
    heat: 1,
    drops: 3,
  },
};

interface EffortSegment {
  readonly value: number;
  readonly height: number;
  readonly ariaLabel: string;
  readonly toneClass: string;
}

interface IntensityTile {
  readonly id: IntensityId;
  readonly label: string;
  readonly scaleLabel: string;
  readonly rpe: number;
  readonly selected: boolean;
  readonly bars: readonly string[];
}

interface SweatDrop {
  readonly path: string;
  readonly duration: number;
  readonly delay: number;
}

interface HeatLine {
  readonly path: string;
  readonly delay: number;
}

const BAR_BLOCK = 'training-intensity-step__bar';
const SEGMENT_BLOCK = 'training-intensity-step__segment-fill';
/** The tile's three bars are 8, 14 and 20 px tall. */
const BAR_SIZES = ['sm', 'md', 'lg'] as const;

function dropPath(x: number, y: number): string {
  return `M${x} ${y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

/** The bar within the tile: colored when the tile is selected, dimmed when the level is reached, otherwise fully pale. */
function barClasses(index: number, reached: boolean, selected: boolean, tone: Tone): string {
  const size = `${BAR_BLOCK}--${BAR_SIZES[index]}`;
  if (selected && reached) {
    return `${size} ${BAR_BLOCK}--${tone}`;
  }
  return `${size} ${BAR_BLOCK}--${reached ? 'muted' : 'dim'}`;
}

/**
 * Step 9: how hard do you train?
 *
 * The RPE number (1–10) is set either on the bar scale or with the three tiles, and it
 * drives the figure's expression: mouth, brows, cheeks, headband, bob tempo, heat lines
 * and sweat. The body is `FigureBody`; only heat and sweat are drawn here.
 */
@Component({
  selector: 'app-training-intensity-step',
  imports: [FigureTempo, FigureBody, UiOptionCard, TranslatePipe],
  templateUrl: './training-intensity-step.html',
  styleUrl: './training-intensity-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'training-intensity-step' },
})
export class TrainingIntensityStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);

  protected readonly rpe = computed(() => {
    const value = this.state.trainingRpe();
    return value === null ? null : clamp(value, RPE_MIN, RPE_MAX);
  });

  protected readonly intensity = computed(() => this.calculator.intensityFor(this.rpe()));
  private readonly scene = computed<IntensityScene>(() => {
    const intensity = this.intensity();
    return intensity === null ? NEUTRAL_SCENE : SCENES[intensity.id];
  });

  protected readonly rpeText = computed(() => {
    const rpe = this.rpe();
    return rpe === null ? RPE_PLACEHOLDER : String(rpe);
  });

  protected readonly toneClass = computed(() => {
    const intensity = this.intensity();
    return intensity === null
      ? 'training-intensity-step__count--none'
      : `training-intensity-step__count--${intensity.tone}`;
  });

  protected readonly intro = computed(() => {
    const intensity = this.intensity();
    return intensity === null
      ? this.t(INTRO_UNSELECTED_KEY)
      : this.t('signup.trainingIntensityStep.introSelected', {
          intensity: this.t(intensity.adjectiveKey),
        });
  });

  protected readonly caption = computed(() =>
    this.t(this.rpe() === null ? CAPTION_UNSELECTED_KEY : CAPTION_SELECTED_KEY),
  );
  protected readonly hint = computed(() => (this.rpe() === null ? '' : this.t(HINT_SELECTED_KEY)));
  protected readonly talkTest = computed(() => {
    const intensity = this.intensity();
    return intensity ? this.t(intensity.talkTestKey) : this.t(TALK_TEST_UNSELECTED_KEY);
  });

  protected readonly segments = computed<readonly EffortSegment[]>(() => {
    const rpe = this.rpe();
    const tone = this.intensity()?.tone;
    return Array.from({ length: RPE_MAX }, (_unused, index) => {
      const value = index + 1;
      const filled = rpe !== null && value <= rpe && tone !== undefined;
      return {
        value,
        height: EFFORT_BAR_BASE_HEIGHT + value * EFFORT_BAR_STEP_HEIGHT,
        ariaLabel: this.t('signup.trainingIntensityStep.segmentLabel', { value, max: RPE_MAX }),
        toneClass: filled ? `${SEGMENT_BLOCK}--${tone}` : `${SEGMENT_BLOCK}--empty`,
      };
    });
  });

  protected readonly tiles = computed<readonly IntensityTile[]>(() => {
    const selectedId = this.intensity()?.id ?? null;
    return INTENSITIES.map((intensity) => {
      const selected = intensity.id === selectedId;
      return {
        id: intensity.id,
        label: this.t(intensity.labelKey),
        scaleLabel: intensity.scaleLabel,
        rpe: intensity.rpe,
        selected,
        bars: BAR_SIZES.map((_unused, index) =>
          barClasses(index, intensity.level >= index + 1, selected, intensity.tone),
        ),
      };
    });
  });

  protected readonly figure = animatedFigure(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm(), this.scene().mood),
  );

  protected readonly bandTone = computed(() => this.scene().band);
  protected readonly bobDuration = computed(() => this.scene().bobDuration);
  protected readonly bobPlayState = computed(() =>
    this.intensity() === null ? 'paused' : 'running',
  );
  protected readonly heatDuration = HEAT_DURATION_S;
  protected readonly heatOpacity = computed(() => this.scene().heat);

  protected readonly expression = computed<Partial<FigureExpression>>(() => {
    const scene = this.scene();
    return {
      smileOpacity: scene.smileOpacity,
      mouthRx: scene.mouthRx,
      mouthRy: scene.mouthRy,
      tongueRx: scene.tongueRx,
      tongueRy: scene.tongueRy,
      browRotation: -scene.browRotation,
      browRotationRight: scene.browRotation,
      browOpacity: scene.browOpacity,
      cheekTone: scene.cheekTone,
      cheekRadius: scene.cheekRadius,
    };
  });

  protected readonly heatLines = computed<readonly HeatLine[]>(() => {
    if (this.scene().heat === 0) {
      return [];
    }
    const y = this.figure().headY + HEAT_OFFSET_Y;
    return [
      { path: `M80 ${y} c 6 -6 -6 -10 0 -18`, delay: 0 },
      { path: `M100 ${y} c 6 -6 -6 -10 0 -18`, delay: 0.35 },
      { path: `M120 ${y} c 6 -6 -6 -10 0 -18`, delay: 0.7 },
    ];
  });

  protected readonly sweat = computed<readonly SweatDrop[]>(() => {
    const drops = this.scene().drops;
    if (drops === 0) {
      return [];
    }
    const headY = this.figure().headY;
    const all: readonly SweatDrop[] = [
      { path: dropPath(70, Math.round(headY - 16)), duration: 1.1, delay: 0 },
      { path: dropPath(132, Math.round(headY - 12)), duration: 1.3, delay: 0.4 },
      { path: dropPath(60, Math.round(headY + 6)), duration: 1.5, delay: 0.8 },
    ];
    return all.slice(0, drops);
  });

  protected select(rpe: number): void {
    this.state.trainingRpe.set(rpe);
  }
}
