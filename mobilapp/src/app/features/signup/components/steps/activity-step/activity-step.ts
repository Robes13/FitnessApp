import { FigureTempo } from '../../../../../shared/components/figure';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { STEPS_MAX, STEPS_MIN } from '../../../../../core/constants/nutrition';
import { Gender } from '../../../../../core/models/profile';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { formatDecimal, formatInteger } from '../../../../../core/utils/date-format';
import { clamp, roundTo } from '../../../../../core/utils/math';
import { animatedFigure, computeFigureGeometry } from '../../../../../shared/components/figure';
import {
  RULER_BLEED_IDLE_STRONG,
  RulerLabelFormatter,
} from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';

/** Below this step count, the walking scene swaps places with the couch scene. */
const LAZY_MAX_STEPS = 2500;
/** Below this step count, the figure stands still (design's `walkPlay`). */
const WALK_PAUSE_STEPS = 400;
const DOG_MIN_STEPS = 8000;
const SPEED_MIN_STEPS = 9000;
const SWEAT_MIN_STEPS = 12000;
const SWEAT_SECOND_DROP_STEPS = 17000;
const MEDAL_MIN_STEPS = 25000;
/** The number jumps every time you cross a thousand. */
const STEPS_PER_TICK = 1000;
/** Confetti at 10,000 steps. */
const CONFETTI_STEPS = 10000;
const CONFETTI_VISIBLE_MS = 1300;
const CONFETTI_COUNT = 12;

/** Design's thresholds for the subtitle. */
const SUBTITLE_EVERYDAY_STEPS = 6000;
const SUBTITLE_SOLID_STEPS = 12000;

const SUBTITLE_LAZY = 'Sofa-liga – helt fair. Bruges til dit kaloriebehov.';
const SUBTITLE_EVERYDAY = 'Almindelig hverdag. Bruges til dit kaloriebehov.';
const SUBTITLE_SOLID = 'Solidt hverdagsniveau. Bruges til dit kaloriebehov.';
const SUBTITLE_HIGH = 'Du går altså meget. Bruges til dit kaloriebehov.';

/** The ruler: one tick per 100 steps, 5.6 px between ticks, a label every 2,000. */
const RULER_TICK_UNIT = 100;
const RULER_PX_PER_TICK = 5.6;
const RULER_STEP = 100;
const RULER_LABEL_EVERY = 20;
const RULER_GLOW_REACH = 8;
const STEPS_PER_LABEL_UNIT = 1000;

/** The walking animation's timing (design's `walkDur`). */
const WALK_BASE_DURATION_S = 1.2;
const WALK_MIN_DURATION_S = 0.32;
const WALK_SPEED_DIVISOR = 20000;
const WALK_SPEED_RANGE_S = 0.88;
const GROUND_DURATION_FACTOR = 0.5;

/** The scenes' entry/exit as they swap places. */
const WALK_SHIFT_PX = -58;
const WALK_SCALE_SMALL = 0.88;
const LAZY_SHIFT_PX = 52;
const LAZY_SCALE_SMALL = 0.86;

const SPEED_FADE_STEPS = 9000;
const SPEED_MAX_OPACITY = 0.9;

const GROUND_DASH_COUNT = 9;
const GROUND_DASH_GAP = 40;
const GROUND_DASH_START = -40;

const ARM_HEIGHT_FACTOR = 0.72;

/** The dog's trot and the TV glow have fixed timings in the design. */
const TROT_DURATION_S = 0.5;
const TV_GLOW_DURATION_S = 2.4;

/** The confetti's colors, in the design's order. */
const CONFETTI_TONES = ['accent', 'positive', 'info', 'warning'] as const;

interface ConfettiParticle {
  readonly left: number;
  readonly driftX: number;
  readonly rotation: number;
  readonly delay: number;
  readonly toneClass: string;
}

interface SweatDrop {
  readonly path: string;
  readonly duration: number;
  readonly delay: number;
}

interface GroundDash {
  readonly x: number;
}

/** The measurements the walking scene has beyond the figure's own geometry (design's `afig`). */
interface WalkExtras {
  readonly armHeight: number;
  readonly armBackX: number;
  readonly armFrontX: number;
  readonly shoulderY: number;
  readonly backLegOrigin: string;
  readonly frontLegOrigin: string;
  readonly backArmOrigin: string;
  readonly frontArmOrigin: string;
  readonly medalCy: number;
  readonly medalRibbon: string;
  readonly speedY1: number;
  readonly speedY2: number;
}

/** Design's sweat drop – the same path in every scene. */
function dropPath(x: number, y: number): string {
  return `M${x} ${y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

function bandModifier(gender: Gender | null): string {
  if (gender === 'kvinde') {
    return 'activity-step__band--pink';
  }
  return gender === 'andet' ? 'activity-step__band--white' : 'activity-step__band--accent';
}

/** `0` and `2k`, `4k` … as in design's `stepRuler`. */
const formatStepLabel: RulerLabelFormatter = (tickValue) =>
  tickValue === 0 ? '0' : `${tickValue / STEPS_PER_LABEL_UNIT}k`;

const CONFETTI_PARTICLES: readonly ConfettiParticle[] = Array.from(
  { length: CONFETTI_COUNT },
  (_unused, index) => ({
    left: 10 + ((index * 13) % 130),
    driftX: ((index * 37) % 60) - 30,
    rotation: (index * 53) % 360,
    delay: (index % 4) * 0.06,
    toneClass: `activity-step__confetti--${CONFETTI_TONES[index % CONFETTI_TONES.length]}`,
  }),
);

const GROUND_DASHES: readonly GroundDash[] = Array.from(
  { length: GROUND_DASH_COUNT },
  (_unused, index) => ({ x: GROUND_DASH_START + index * GROUND_DASH_GAP }),
);

/**
 * Step 6: how many steps do you take on an average day?
 *
 * The number, the activity level and the two conversions come from `NutritionCalculator`;
 * the rest of the step is the design's scene. Above 2,500 steps the figure walks to the
 * left at a pace that follows the number (dog from 8,000, speed lines from 9,000, sweat
 * from 12,000, medal from 25,000) – below 2,500 the couch scene slides in instead. The
 * walking figure is drawn in the step rather than with `FigureBody`, because the legs and
 * arms need to be animated independently around their own hips and shoulders.
 */
@Component({
  selector: 'app-activity-step',
  imports: [FigureTempo, UiRuler],
  templateUrl: './activity-step.html',
  styleUrl: './activity-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'activity-step' },
})
export class ActivityStep {
  private readonly calculator = inject(NutritionCalculator);
  private confettiTimer: ReturnType<typeof setTimeout> | null = null;
  private previousSteps: number | null = null;

  protected readonly state = inject(SignupStateService);

  protected readonly rulerMin = STEPS_MIN;
  protected readonly rulerMax = STEPS_MAX;
  protected readonly rulerStep = RULER_STEP;
  protected readonly rulerTickUnit = RULER_TICK_UNIT;
  protected readonly rulerPxPerTick = RULER_PX_PER_TICK;
  protected readonly rulerLabelEvery = RULER_LABEL_EVERY;
  protected readonly rulerGlowReach = RULER_GLOW_REACH;
  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly rulerLabelFormatter = formatStepLabel;
  protected readonly groundDashes = GROUND_DASHES;
  /** The scenes' fixed timings (seconds) – the design's own values. */
  protected readonly trotDuration = TROT_DURATION_S;
  protected readonly tvGlowDuration = TV_GLOW_DURATION_S;

  protected readonly dragging = signal(false);
  /** Alternates between the two identical keyframes, so the number jump can restart. */
  private readonly tickFlip = signal(false);
  private readonly confettiOn = signal(false);

  protected readonly steps = computed(() => clamp(this.state.stepsPerDay(), STEPS_MIN, STEPS_MAX));
  protected readonly stepsText = computed(() => formatInteger(this.steps()));
  protected readonly activityLabel = computed(
    () => this.calculator.activityLevelFor(this.steps()).label,
  );
  protected readonly kmText = computed(() =>
    formatDecimal(this.calculator.stepsToKm(this.steps())),
  );
  protected readonly kcalText = computed(() =>
    formatInteger(this.calculator.stepsToKcal(this.steps(), this.state.weightKg())),
  );

  protected readonly subtitle = computed(() => {
    const steps = this.steps();
    if (steps < LAZY_MAX_STEPS) {
      return SUBTITLE_LAZY;
    }
    if (steps < SUBTITLE_EVERYDAY_STEPS) {
      return SUBTITLE_EVERYDAY;
    }
    return steps < SUBTITLE_SOLID_STEPS ? SUBTITLE_SOLID : SUBTITLE_HIGH;
  });

  protected readonly tickAnimation = computed(() => (this.tickFlip() ? 'numtickA' : 'numtickB'));
  protected readonly confetti = computed<readonly ConfettiParticle[]>(() =>
    this.confettiOn() ? CONFETTI_PARTICLES : [],
  );

  protected readonly figure = animatedFigure(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm()),
  );

  protected readonly walk = computed<WalkExtras>(() => {
    const g = this.figure();
    return {
      armHeight: Math.round(g.legH * ARM_HEIGHT_FACTOR),
      armBackX: g.bodyX - 3,
      armFrontX: g.bodyX + g.bodyW - 12,
      shoulderY: g.bodyY + 14,
      backLegOrigin: `${g.legLX + 10}px ${g.legY}px`,
      frontLegOrigin: `${g.legRX + 10}px ${g.legY}px`,
      backArmOrigin: `${g.bodyX + 4.5}px ${g.bodyY + 14}px`,
      frontArmOrigin: `${g.bodyX + g.bodyW - 4.5}px ${g.bodyY + 14}px`,
      medalCy: g.bodyY + 18,
      medalRibbon: `M92 ${g.bodyY} l8 16 l8 -16`,
      speedY1: g.bodyY + 12,
      speedY2: g.beltY,
    };
  });

  protected readonly bandClass = computed(() => bandModifier(this.state.gender()));

  /** Design's `walkDur`: 1.2 s at rest, down to 0.32 s at a high step count. */
  protected readonly walkDuration = computed(() => {
    const steps = this.steps();
    const duration =
      steps < WALK_PAUSE_STEPS
        ? WALK_BASE_DURATION_S
        : Math.max(
            WALK_MIN_DURATION_S,
            WALK_BASE_DURATION_S - (steps / WALK_SPEED_DIVISOR) * WALK_SPEED_RANGE_S,
          );
    return roundTo(duration, 2);
  });
  protected readonly groundDuration = computed(() =>
    roundTo(this.walkDuration() * GROUND_DURATION_FACTOR, 2),
  );
  protected readonly walkPlayState = computed(() =>
    this.steps() < WALK_PAUSE_STEPS ? 'paused' : 'running',
  );

  private readonly isLazy = computed(() => this.steps() < LAZY_MAX_STEPS);
  protected readonly walkOpacity = computed(() => (this.isLazy() ? 0 : 1));
  protected readonly walkShift = computed(() => (this.isLazy() ? WALK_SHIFT_PX : 0));
  protected readonly walkScale = computed(() => (this.isLazy() ? WALK_SCALE_SMALL : 1));
  protected readonly lazyOpacity = computed(() => (this.isLazy() ? 1 : 0));
  protected readonly lazyShift = computed(() => (this.isLazy() ? 0 : LAZY_SHIFT_PX));
  protected readonly lazyScale = computed(() => (this.isLazy() ? 1 : LAZY_SCALE_SMALL));

  protected readonly dogOpacity = computed(() => (this.steps() >= DOG_MIN_STEPS ? 1 : 0));
  protected readonly medalOpacity = computed(() => (this.steps() >= MEDAL_MIN_STEPS ? 1 : 0));
  protected readonly speedOpacity = computed(() => {
    const steps = this.steps();
    return steps < SPEED_MIN_STEPS
      ? 0
      : Math.min(SPEED_MAX_OPACITY, (steps - SPEED_MIN_STEPS) / SPEED_FADE_STEPS);
  });

  protected readonly sweat = computed<readonly SweatDrop[]>(() => {
    const steps = this.steps();
    if (steps < SWEAT_MIN_STEPS) {
      return [];
    }
    const headY = this.figure().headY;
    const drops: readonly SweatDrop[] = [
      { path: dropPath(70, headY - 18), duration: 1.1, delay: 0 },
      { path: dropPath(130, headY - 14), duration: 1.3, delay: 0.45 },
    ];
    return drops.slice(0, steps > SWEAT_SECOND_DROP_STEPS ? 2 : 1);
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clearConfettiTimer());
    effect(() => {
      const steps = this.steps();
      const previous = this.previousSteps;
      this.previousSteps = steps;
      if (previous === null || previous === steps) {
        return;
      }
      if (Math.floor(steps / STEPS_PER_TICK) !== Math.floor(previous / STEPS_PER_TICK)) {
        this.tickFlip.update((flip) => !flip);
      }
      if (steps >= CONFETTI_STEPS && previous < CONFETTI_STEPS) {
        this.showConfetti();
      }
    });
  }

  private showConfetti(): void {
    this.clearConfettiTimer();
    this.confettiOn.set(true);
    this.confettiTimer = setTimeout(() => this.confettiOn.set(false), CONFETTI_VISIBLE_MS);
  }

  private clearConfettiTimer(): void {
    if (this.confettiTimer !== null) {
      clearTimeout(this.confettiTimer);
      this.confettiTimer = null;
    }
  }
}
