import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { INTENSITIES, RPE_MAX, RPE_MIN } from '../../../../../core/constants/nutrition';
import { IntensityDefinition } from '../../../../../core/models/profile';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator';
import { NOW } from '../../../../../core/utils/now';
import { FigureBody, computeFigureGeometry } from '../../../../../shared/components/figure';
import { UiIcon } from '../../../../../shared/components/ui-icon/ui-icon';
import { UiRowButton } from '../../../../../shared/components/ui-row-button/ui-row-button';
import { UiTextInput } from '../../../../../shared/components/ui-text-input/ui-text-input';
import { SignupStateService, SignupStepId } from '../../../services/signup-state';
import { bandToneForGender } from '../../../../../shared/components/figure';
import { buildSummaryRows } from './summary-rows';

const CAPTION_NO_EMAIL =
  'Skriv din e-mail – den bruger vi til at bekræfte kontoen. Tryk på en linje for at rette.';
const CAPTION_NO_TERMS =
  'Alt ser rigtigt ud? Tryk på en linje for at rette, og sæt et flueben nedenfor.';
const CAPTION_READY = 'Sådan. Nu mangler kun det sidste tryk.';

const EMAIL_PLACEHOLDER = 'Din e-mail · dig@mail.dk';
const EDIT_LABEL_PREFIX = 'Ret ';

/** Designets faste mål fra skærmen (HTML-linje 849–856), bundet som CSS-variabler. */
const SUMMARY_LAYOUT = { figureWidth: 92, figureHeight: 124, captionHeight: 36 } as const;

/** Figurens humør: den retter sig op, når betingelserne er accepteret. */
const MOOD_SIGNED = 1;
const MOOD_WAITING = 0.15;
/** Pennen sidder i højre hånd; designets `sfig.penX/penY`. */
const PEN_OFFSET_X = 8;
const HAND_RATIO = 0.72;
const LIFT_RATIO = 0.9;
/** Fluebenets streg er tykkere end standardikonets (designet: 3.2 SVG-enheder). */
const CHECK_STROKE_WIDTH = 3.2;

/** Gnist i designets `signSparks` – position i figurens viewBox og forsinkelse i sekunder. */
interface SignSpark {
  readonly path: string;
  readonly delay: number;
}

const SPARK_POSITIONS: readonly {
  readonly x: number;
  readonly dy: number;
  readonly delay: number;
}[] = [
  { x: 40, dy: -30, delay: 0 },
  { x: 150, dy: -48, delay: 0.3 },
  { x: 62, dy: -58, delay: 0.6 },
];

function sparkPath(x: number, y: number): string {
  return `M${x} ${y} l 3 -8 l 3 8 l 8 3 l -8 3 l -3 8 l -3 -8 l -8 -3 z`;
}

/**
 * Trin `summary` (designets `s6`): "Tjek og **bekræft**".
 *
 * Her samles hele kladden i ni linjer. Hver linje er en knap, der sender brugeren tilbage
 * til sit trin i rette-tilstand (`SignupStateService.jumpTo`), hvorefter "Næste" hedder
 * "Gem" og fører tilbage hertil. E-mail og flueben er de to sidste betingelser, før
 * "Opret konto" bliver aktiv — selve oprettelsen sker på siden, ikke i trinnet.
 */
@Component({
  selector: 'app-summary-step',
  imports: [FigureBody, ReactiveFormsModule, UiIcon, UiRowButton, UiTextInput],
  templateUrl: './summary-step.html',
  styleUrl: './summary-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'summary-step',
    '[style.--summary-figure-width.px]': 'layout.figureWidth',
    '[style.--summary-figure-height.px]': 'layout.figureHeight',
    '[style.--summary-caption-height.px]': 'layout.captionHeight',
  },
})
export class SummaryStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);

  protected readonly state = inject(SignupStateService);
  protected readonly layout = SUMMARY_LAYOUT;
  protected readonly emailPlaceholder = EMAIL_PLACEHOLDER;
  protected readonly checkStrokeWidth = CHECK_STROKE_WIDTH;

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true }),
  });

  private readonly emailValid = computed(() => this.calculator.isValidEmail(this.state.email()));
  /** Rød kant først, når der faktisk står noget forkert – ikke i det tomme felt. */
  protected readonly emailInvalid = computed(
    () => this.state.email().length > 0 && !this.emailValid(),
  );

  protected readonly caption = computed(() => {
    if (!this.emailValid()) {
      return CAPTION_NO_EMAIL;
    }
    return this.state.termsAccepted() ? CAPTION_READY : CAPTION_NO_TERMS;
  });

  private readonly intensity = computed<IntensityDefinition | null>(() => {
    const rpe = this.state.trainingRpe();
    if (rpe === null) {
      return null;
    }
    const clamped = Math.min(RPE_MAX, Math.max(RPE_MIN, rpe));
    return (
      INTENSITIES.find((candidate) => clamped <= candidate.maxRpe) ??
      INTENSITIES[INTENSITIES.length - 1] ??
      null
    );
  });

  /** Målvægten klemt ind i skalaens grænser, så linjen viser det samme som mål-trinnet. */
  private readonly boundedGoalWeightKg = computed(() => {
    const { min, max } = this.calculator.goalWeightBounds(this.state.goal(), this.state.weightKg());
    return Math.min(max, Math.max(min, this.state.goalWeightKg()));
  });

  protected readonly rows = computed(() =>
    buildSummaryRows({
      username: this.state.username().trim(),
      age: this.calculator.ageFromBirthday(this.state.birthday(), this.now()),
      gender: this.state.gender(),
      weightKg: this.state.weightKg(),
      heightCm: this.state.heightCm(),
      stepsPerDay: this.state.stepsPerDay(),
      activityLabel: this.calculator.activityLevelFor(this.state.stepsPerDay()).label,
      trainingDayCount: this.state.trainingDays().filter(Boolean).length,
      trainingMinutes: this.state.trainingMinutes(),
      intensity: this.intensity(),
      goal: this.state.goal(),
      goalWeightKg: this.boundedGoalWeightKg(),
      pace: this.state.pace(),
      notifications: this.state.notifications(),
    }),
  );

  private readonly mood = computed(() => (this.state.termsAccepted() ? MOOD_SIGNED : MOOD_WAITING));
  protected readonly geometry = computed(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm(), this.mood()),
  );
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  /** Pennen starter i hånden: samme punkt som højre arms endepunkt. */
  protected readonly penPath = computed(() => {
    const geometry = this.geometry();
    const lift = this.mood() * geometry.bodyH * LIFT_RATIO;
    const x = Math.round(geometry.bodyX + geometry.bodyW + PEN_OFFSET_X);
    const y = Math.round(geometry.bodyY + geometry.bodyH * HAND_RATIO - lift);
    return `M${x} ${y} l 14 -34`;
  });

  /** Gnisterne vises kun, når betingelserne er accepteret. */
  protected readonly sparks = computed<readonly SignSpark[]>(() => {
    if (!this.state.termsAccepted()) {
      return [];
    }
    const headY = computeFigureGeometry(
      this.state.weightKg(),
      this.state.heightCm(),
      MOOD_SIGNED,
    ).headY;
    return SPARK_POSITIONS.map(({ x, dy, delay }) => ({ path: sparkPath(x, headY + dy), delay }));
  });

  constructor() {
    this.form.controls.email.setValue(this.state.email(), { emitEvent: false });
    this.form.controls.email.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((email) => this.state.email.set(email));
  }

  protected editLabel(label: string): string {
    return `${EDIT_LABEL_PREFIX}${label}`;
  }

  protected edit(step: SignupStepId): void {
    this.state.jumpTo(step);
  }

  protected toggleTerms(): void {
    this.state.termsAccepted.update((accepted) => !accepted);
  }
}
