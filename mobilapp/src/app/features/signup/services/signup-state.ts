import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, switchMap, tap } from 'rxjs';
import { APP_PATH } from '../../../core/constants/app-route';
import { DEMO_PROFILE_DEFAULTS } from '../../../core/constants/demo-data';
import { MAX_AGE, MIN_AGE, PASSWORD_MIN_LENGTH } from '../../../core/constants/nutrition';
import { Gender, GoalId, PaceId, UserProfile } from '../../../core/models/profile';
import { AuthApi } from '../../../core/services/auth-api';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { SessionService } from '../../../core/services/session';
import { UserProfileService } from '../../../core/services/user-profile';
import { NOW } from '../../../core/utils/now';

/** Designets `order`: `s1, sAlder, sKon, s2, s3, sAkt, sFreq, sDur, sInt, s4, sMaal, s5, sNotif, s6`. */
export type SignupStepId =
  | 'account'
  | 'birthday'
  | 'gender'
  | 'weight'
  | 'height'
  | 'activity'
  | 'training-frequency'
  | 'training-duration'
  | 'training-intensity'
  | 'goal'
  | 'goal-weight'
  | 'pace'
  | 'notifications'
  | 'summary';

export const SIGNUP_STEP_ORDER: readonly SignupStepId[] = [
  'account',
  'birthday',
  'gender',
  'weight',
  'height',
  'activity',
  'training-frequency',
  'training-duration',
  'training-intensity',
  'goal',
  'goal-weight',
  'pace',
  'notifications',
  'summary',
];

/** Ét kapitel i fremdriftslinjen. `flex` er antal synlige trin, `pct` er 0..100. */
export interface SignupChapter {
  label: string;
  flex: number;
  pct: number;
  active: boolean;
  done: boolean;
}

/** Designets prop `skipPaceForMaintain`: tempo-trinnet springes over ved målet "holde vægten". */
export const SKIP_PACE_FOR_MAINTAIN = true;

const FIRST_STEP: SignupStepId = 'account';
const SUMMARY_STEP: SignupStepId = 'summary';

const CHAPTER_DEFINITIONS: readonly {
  readonly label: string;
  readonly steps: readonly SignupStepId[];
}[] = [
  { label: 'Dig', steps: ['account', 'birthday', 'gender', 'weight', 'height'] },
  {
    label: 'Aktivitet',
    steps: ['activity', 'training-frequency', 'training-duration', 'training-intensity'],
  },
  { label: 'Mål', steps: ['goal', 'goal-weight', 'pace'] },
  { label: 'Afslut', steps: ['notifications', 'summary'] },
];

/**
 * Designets `editChains`: retter man et trin, der hører sammen med de næste, bliver man i
 * kæden i stedet for at hoppe direkte tilbage til opsummeringen.
 */
const EDIT_CHAINS: Partial<Record<SignupStepId, readonly SignupStepId[]>> = {
  'training-frequency': ['training-frequency', 'training-duration', 'training-intensity'],
  goal: ['goal', 'goal-weight', 'pace'],
};

const NEXT_LABEL = 'Næste';
const SAVE_LABEL = 'Gem';
const SUBMIT_LABEL = 'Opret konto';
const PERCENT_MAX = 100;

/**
 * Kladden bag oprettelsesflowet: ét signal pr. felt, trin-navigationen og den afledte
 * fremdrift. Servicen leveres af ruten (`SIGNUP_ROUTES`), ikke i roden, så kladden lever
 * præcis lige så længe som flowet og starter forfra, hvis brugeren forlader det.
 *
 * Trinkomponenterne injicerer servicen direkte og skriver i kladde-signalerne – de har
 * hverken inputs eller outputs.
 */
@Injectable()
export class SignupStateService {
  private readonly calculator = inject(NutritionCalculator);
  private readonly profiles = inject(UserProfileService);
  private readonly session = inject(SessionService);
  private readonly authApi = inject(AuthApi);
  private readonly router = inject(Router);
  private readonly now = inject(NOW);

  // --- Kladde. Startværdierne er designets initielle state (= DEMO_PROFILE_DEFAULTS). ---
  readonly username = signal('');
  readonly password = signal('');
  readonly passwordRepeat = signal('');
  /** ISO-dato (`YYYY-MM-DD`) eller `null`. */
  readonly birthday = signal<string | null>(DEMO_PROFILE_DEFAULTS.birthday);
  readonly gender = signal<Gender | null>(DEMO_PROFILE_DEFAULTS.gender);
  readonly weightKg = signal(DEMO_PROFILE_DEFAULTS.weightKg);
  readonly heightCm = signal(DEMO_PROFILE_DEFAULTS.heightCm);
  readonly stepsPerDay = signal(DEMO_PROFILE_DEFAULTS.stepsPerDay);
  /** Syv flag, mandag først. Skift ét med `toggleTrainingDay`. */
  readonly trainingDays = signal<readonly boolean[]>(DEMO_PROFILE_DEFAULTS.trainingDays);
  readonly trainingMinutes = signal(DEMO_PROFILE_DEFAULTS.trainingMinutes);
  readonly trainingRpe = signal<number | null>(DEMO_PROFILE_DEFAULTS.trainingRpe);
  readonly goal = signal<GoalId | null>(DEMO_PROFILE_DEFAULTS.goal);
  readonly goalWeightKg = signal(DEMO_PROFILE_DEFAULTS.goalWeightKg);
  readonly pace = signal<PaceId | null>(DEMO_PROFILE_DEFAULTS.pace);
  /** `null` = ikke besvaret endnu. Designet starter på "Ja tak". */
  readonly notifications = signal<boolean | null>(DEMO_PROFILE_DEFAULTS.notificationsEnabled);
  readonly email = signal('');
  readonly termsAccepted = signal(false);

  private readonly stepState = signal<SignupStepId>(FIRST_STEP);
  private readonly editFromState = signal<SignupStepId | null>(null);

  readonly step: Signal<SignupStepId> = this.stepState.asReadonly();
  /** Det trin, opsummeringen sendte brugeren hen til – ellers `null`. */
  readonly editFrom: Signal<SignupStepId | null> = this.editFromState.asReadonly();
  readonly isEditing = computed(
    () => this.editFromState() !== null && this.stepState() !== SUMMARY_STEP,
  );

  private readonly trainingDayCount = computed(() => this.trainingDays().filter(Boolean).length);
  private readonly maintainsWeight = computed(() => this.goal() === 'hold');
  private readonly skipsPace = computed(() => SKIP_PACE_FOR_MAINTAIN && this.maintainsWeight());
  private readonly age = computed(() =>
    this.calculator.ageFromBirthday(this.birthday(), this.now()),
  );
  /** Målvægten klemt ind i skalaens grænser – designets `goalW`. */
  private readonly boundedGoalWeightKg = computed(() => {
    const bounds = this.calculator.goalWeightBounds(this.goal(), this.weightKg());
    return Math.min(bounds.max, Math.max(bounds.min, this.goalWeightKg()));
  });

  /** Designets `visOrder`: rækkefølgen uden de trin, brugerens svar gør overflødige. */
  readonly visibleOrder: Signal<readonly SignupStepId[]> = computed(() => {
    const noTrainingDays = this.trainingDayCount() === 0;
    const maintains = this.maintainsWeight();
    const skipsPace = this.skipsPace();
    return SIGNUP_STEP_ORDER.filter((id) => {
      if (noTrainingDays && (id === 'training-duration' || id === 'training-intensity')) {
        return false;
      }
      if (maintains && id === 'goal-weight') {
        return false;
      }
      return !(skipsPace && id === 'pace');
    });
  });

  readonly stepNumber = computed(() => this.visibleOrder().indexOf(this.stepState()) + 1);
  readonly stepTotal = computed(() => this.visibleOrder().length);
  readonly progressValue = computed(() => {
    const total = this.stepTotal();
    return total > 0 ? this.stepNumber() / total : 0;
  });

  readonly chapters: Signal<readonly SignupChapter[]> = computed(() => {
    const visibleOrder = this.visibleOrder();
    const stepNumber = this.stepNumber();
    const current = this.stepState();
    return CHAPTER_DEFINITIONS.map(({ label, steps }) => {
      const visible = steps.filter((id) => visibleOrder.includes(id));
      const index = visible.indexOf(current);
      const last = visible[visible.length - 1];
      const done = last !== undefined && visibleOrder.indexOf(last) < stepNumber - 1;
      const pct =
        index >= 0
          ? Math.round(((index + 1) / visible.length) * PERCENT_MAX)
          : done
            ? PERCENT_MAX
            : 0;
      return { label, flex: visible.length, pct, active: index >= 0, done };
    });
  });

  /** Designets `canNext` – ét udtryk pr. trin. */
  readonly canContinue = computed(() => {
    switch (this.stepState()) {
      case 'account':
        return (
          this.username().trim().length > 0 &&
          this.password().length >= PASSWORD_MIN_LENGTH &&
          this.password() === this.passwordRepeat()
        );
      case 'birthday': {
        const age = this.age();
        return age >= MIN_AGE && age <= MAX_AGE;
      }
      case 'gender':
        return this.gender() !== null;
      case 'weight':
        return this.weightKg() > 0;
      case 'height':
        return this.heightCm() > 0;
      case 'activity':
      case 'training-frequency':
      case 'training-duration':
        return true;
      case 'training-intensity':
        return this.trainingRpe() !== null;
      case 'goal':
        return this.goal() !== null;
      case 'goal-weight':
        return this.calculator.isGoalWeightRealistic(
          this.goal(),
          this.boundedGoalWeightKg(),
          this.heightCm(),
        );
      case 'pace':
        return this.pace() !== null;
      case 'notifications':
        return this.notifications() !== null;
      case 'summary':
        return this.calculator.isValidEmail(this.email()) && this.termsAccepted();
    }
  });

  /** Designets `calcNext`: næste synlige trin. */
  private readonly nextStep = computed<SignupStepId | null>(() => this.neighbour(1));

  private readonly editChain = computed<readonly SignupStepId[]>(() => {
    const from = this.editFromState();
    if (from === null || !this.isEditing()) {
      return [];
    }
    return EDIT_CHAINS[from] ?? [from];
  });

  /** Designets `nextIsSave`: retter man, og forlader næste trin rette-kæden, hedder knappen "Gem". */
  private readonly nextIsSave = computed(() => {
    if (!this.isEditing()) {
      return false;
    }
    const next = this.nextStep();
    return next === null || !this.editChain().includes(next);
  });

  readonly nextLabel = computed(() => {
    if (this.stepState() === SUMMARY_STEP) {
      return SUBMIT_LABEL;
    }
    return this.nextIsSave() ? SAVE_LABEL : NEXT_LABEL;
  });

  /**
   * Går videre. På opsummeringen sker der intet – dér er knappen "Opret konto", og siden
   * kalder `submit()`, fordi den skal vise spinner og fejl.
   */
  next(): void {
    if (this.stepState() === SUMMARY_STEP) {
      return;
    }
    if (this.nextIsSave()) {
      this.returnToSummary();
      return;
    }
    const next = this.nextStep();
    if (next !== null) {
      this.stepState.set(next);
    }
  }

  /** Tilbage ét trin. Fra første trin ud af flowet; midt i en rettelse til opsummeringen. */
  back(): void {
    const previous = this.neighbour(-1);
    const editing = this.isEditing();
    if (previous === null && !editing) {
      void this.router.navigateByUrl(APP_PATH.LOGIN);
      return;
    }
    if (editing && (previous === null || !this.editChain().includes(previous))) {
      this.returnToSummary();
      return;
    }
    if (previous !== null) {
      this.stepState.set(previous);
    }
  }

  /** Designets `jumpEdit`: opsummeringen sender brugeren ind i et trin i rette-tilstand. */
  jumpTo(step: SignupStepId): void {
    this.stepState.set(step);
    this.editFromState.set(step);
  }

  toggleTrainingDay(index: number): void {
    this.trainingDays.update((days) => days.map((on, i) => (i === index ? !on : on)));
  }

  /**
   * Opretter kontoen: registrerer hos (mock-)backenden, skriver kladden som profil og
   * markerer sessionen som oprettet men ubekræftet, så Hjem viser bekræftelses-arket.
   * Profilen skrives først, når registreringen er gået godt.
   */
  submit(): Observable<void> {
    const profile = this.toProfile();
    return this.authApi.register(profile, this.password()).pipe(
      tap(() => this.profiles.replace(profile)),
      switchMap(() => this.session.completeSignup()),
    );
  }

  /**
   * Naboen i `visibleOrder` (`+1` frem, `-1` tilbage) – dermed er spring-reglerne kun
   * beskrevet ét sted. Er det aktive trin selv blevet skjult af et senere svar, findes
   * den nærmeste synlige nabo ud fra den faste rækkefølge i stedet.
   */
  private neighbour(direction: 1 | -1): SignupStepId | null {
    const order = this.visibleOrder();
    const current = this.stepState();
    const index = order.indexOf(current);
    if (index >= 0) {
      return order[index + direction] ?? null;
    }
    const position = SIGNUP_STEP_ORDER.indexOf(current);
    const candidates = order.filter((id) =>
      direction === 1
        ? SIGNUP_STEP_ORDER.indexOf(id) > position
        : SIGNUP_STEP_ORDER.indexOf(id) < position,
    );
    return (direction === 1 ? candidates[0] : candidates[candidates.length - 1]) ?? null;
  }

  private returnToSummary(): void {
    this.stepState.set(SUMMARY_STEP);
    this.editFromState.set(null);
  }

  private toProfile(): UserProfile {
    return {
      username: this.username().trim(),
      email: this.email().trim(),
      birthday: this.birthday(),
      gender: this.gender(),
      weightKg: this.weightKg(),
      heightCm: this.heightCm(),
      stepsPerDay: this.stepsPerDay(),
      trainingDays: [...this.trainingDays()],
      trainingMinutes: this.trainingMinutes(),
      trainingRpe: this.trainingRpe(),
      goal: this.goal(),
      pace: this.pace(),
      goalWeightKg: this.boundedGoalWeightKg(),
      notificationsEnabled: this.notifications() === true,
      units: 'metrisk',
      kcalOverride: null,
      photo: null,
    };
  }
}
