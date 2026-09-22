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
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator';
import { formatDecimal, formatInteger } from '../../../../../core/utils/date-format';
import { animatedFigure, computeFigureGeometry } from '../../../../../shared/components/figure';
import {
  RULER_BLEED_IDLE_STRONG,
  RulerLabelFormatter,
} from '../../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../../shared/components/ui-ruler/ui-ruler';
import { SignupStateService } from '../../../services/signup-state';

/** Under dette antal skridt bytter gå-scenen plads med sofa-scenen. */
const LAZY_MAX_STEPS = 2500;
/** Under dette antal skridt står figuren stille (designets `walkPlay`). */
const WALK_PAUSE_STEPS = 400;
const DOG_MIN_STEPS = 8000;
const SPEED_MIN_STEPS = 9000;
const SWEAT_MIN_STEPS = 12000;
const SWEAT_SECOND_DROP_STEPS = 17000;
const MEDAL_MIN_STEPS = 25000;
/** Tallet hopper, hver gang man krydser et tusinde. */
const STEPS_PER_TICK = 1000;
/** Konfetti ved 10.000 skridt. */
const CONFETTI_STEPS = 10000;
const CONFETTI_VISIBLE_MS = 1300;
const CONFETTI_COUNT = 12;

/** Designets tærskler for underoverskriften. */
const SUBTITLE_EVERYDAY_STEPS = 6000;
const SUBTITLE_SOLID_STEPS = 12000;

const SUBTITLE_LAZY = 'Sofa-liga – helt fair. Bruges til dit kaloriebehov.';
const SUBTITLE_EVERYDAY = 'Almindelig hverdag. Bruges til dit kaloriebehov.';
const SUBTITLE_SOLID = 'Solidt hverdagsniveau. Bruges til dit kaloriebehov.';
const SUBTITLE_HIGH = 'Du går altså meget. Bruges til dit kaloriebehov.';

/** Linealen: én streg pr. 100 skridt, 5,6 px mellem stregerne, etiket hver 2.000. */
const RULER_TICK_UNIT = 100;
const RULER_PX_PER_TICK = 5.6;
const RULER_STEP = 100;
const RULER_LABEL_EVERY = 20;
const RULER_GLOW_REACH = 8;
const STEPS_PER_LABEL_UNIT = 1000;

/** Gå-animationens tempo (designets `walkDur`). */
const WALK_BASE_DURATION_S = 1.2;
const WALK_MIN_DURATION_S = 0.32;
const WALK_SPEED_DIVISOR = 20000;
const WALK_SPEED_RANGE_S = 0.88;
const GROUND_DURATION_FACTOR = 0.5;

/** Scenernes ind-/udgang, når de bytter plads. */
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

/** Hundens trav og tv-skæret har faste tempi i designet. */
const TROT_DURATION_S = 0.5;
const TV_GLOW_DURATION_S = 2.4;

/** Konfettiens farver, i designets rækkefølge. */
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

/** De mål gå-scenen har ud over figurens egen geometri (designets `afig`). */
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Designet skriver animationernes varighed med to decimaler. */
function roundSeconds(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Designets svededråbe – samme path i alle scener. */
function dropPath(x: number, y: number): string {
  return `M${x} ${y} c -3 4 -3 6 -3 7 a 3 3 0 0 0 6 0 c 0 -1 0 -3 -3 -7 z`;
}

function bandModifier(gender: Gender | null): string {
  if (gender === 'kvinde') {
    return 'activity-step__band--pink';
  }
  return gender === 'andet' ? 'activity-step__band--white' : 'activity-step__band--accent';
}

/** `0` og `2k`, `4k` … som i designets `stepRuler`. */
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
 * Trin 6: hvor mange skridt tager du på en almindelig dag?
 *
 * Tallet, aktivitetsniveauet og de to omregninger kommer fra `NutritionCalculator`; resten af
 * trinnet er designets scene. Over 2.500 skridt går figuren mod venstre med et tempo, der følger
 * tallet (hund fra 8.000, fartstreger fra 9.000, sved fra 12.000, medalje fra 25.000) – under
 * 2.500 glider sofa-scenen ind i stedet. Gå-figuren er tegnet i trinnet og ikke med `FigureBody`,
 * fordi ben og arme skal animeres hver for sig om deres egne hofter og skuldre.
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
  /** Scenernes faste tempi (sekunder) – designets egne værdier. */
  protected readonly trotDuration = TROT_DURATION_S;
  protected readonly tvGlowDuration = TV_GLOW_DURATION_S;

  protected readonly dragging = signal(false);
  /** Skifter mellem de to ens keyframes, så talhoppet kan starte forfra. */
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

  /** Designets `walkDur`: 1,2 s i gang, ned mod 0,32 s ved mange skridt. */
  protected readonly walkDuration = computed(() => {
    const steps = this.steps();
    const duration =
      steps < WALK_PAUSE_STEPS
        ? WALK_BASE_DURATION_S
        : Math.max(
            WALK_MIN_DURATION_S,
            WALK_BASE_DURATION_S - (steps / WALK_SPEED_DIVISOR) * WALK_SPEED_RANGE_S,
          );
    return roundSeconds(duration);
  });
  protected readonly groundDuration = computed(() =>
    roundSeconds(this.walkDuration() * GROUND_DURATION_FACTOR),
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
