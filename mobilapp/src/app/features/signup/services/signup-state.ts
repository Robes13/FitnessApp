import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { APP_PATH } from '../../../core/constants/app-route';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '../../../core/constants/auth';
import { DEFAULT_PROFILE } from '../../../core/constants/profile-defaults';
import {
  MAX_AGE,
  MIN_AGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../../core/constants/nutrition';
import { Gender, GoalId, PaceId, UserProfile } from '../../../core/models/profile';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator/nutrition-calculator';
import { SessionService } from '../../../core/services/session/session';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { NOW } from '../../../core/utils/now';
import { clamp } from '../../../core/utils/math';
import { injectTranslate } from '../../../core/services/language/translate';

/** Design's `order`: `s1, sAlder, sKon, s2, s3, sAkt, sFreq, sDur, sInt, s4, sMaal, s5, sNotif, s6`. */
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

/** One chapter in the progress bar. `flex` is the number of visible steps, `pct` is 0..100. */
export interface SignupChapter {
  label: string;
  flex: number;
  pct: number;
  active: boolean;
  done: boolean;
}

/** Design's prop `skipPaceForMaintain`: the pace step is skipped for the "maintain weight" goal. */
export const SKIP_PACE_FOR_MAINTAIN = true;

const FIRST_STEP: SignupStepId = 'account';
const SUMMARY_STEP: SignupStepId = 'summary';

const CHAPTER_DEFINITIONS: readonly {
  readonly labelKey: string;
  readonly steps: readonly SignupStepId[];
}[] = [
  { labelKey: 'signup.chapters.you', steps: ['account', 'birthday', 'gender', 'weight', 'height'] },
  {
    labelKey: 'signup.chapters.activity',
    steps: ['activity', 'training-frequency', 'training-duration', 'training-intensity'],
  },
  { labelKey: 'signup.chapters.goal', steps: ['goal', 'goal-weight', 'pace'] },
  { labelKey: 'signup.chapters.finish', steps: ['notifications', 'summary'] },
];

/**
 * Design's `editChains`: editing a step that belongs together with the next ones keeps you in
 * the chain instead of jumping straight back to the summary.
 */
const EDIT_CHAINS: Partial<Record<SignupStepId, readonly SignupStepId[]>> = {
  'training-frequency': ['training-frequency', 'training-duration', 'training-intensity'],
  goal: ['goal', 'goal-weight', 'pace'],
};

const NEXT_LABEL_KEY = 'signup.state.next';
const SAVE_LABEL_KEY = 'common.save';
const SUBMIT_LABEL_KEY = 'signup.state.submit';
const PERCENT_MAX = 100;

/**
 * The draft behind the signup flow: one signal per field, the step navigation and the derived
 * progress. The service is provided by the route (`SIGNUP_ROUTES`), not at the root, so the draft
 * lives exactly as long as the flow and starts over if the user leaves it.
 *
 * The step components inject the service directly and write to the draft signals – they have
 * neither inputs nor outputs.
 */
@Injectable()
export class SignupStateService {
  private readonly calculator = inject(NutritionCalculator);
  private readonly profiles = inject(UserProfileService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly now = inject(NOW);
  private readonly t = injectTranslate();

  // --- Draft. The starting values are the design's initial state (= DEFAULT_PROFILE). ---
  readonly username = signal('');
  readonly password = signal('');
  readonly passwordRepeat = signal('');
  /** ISO date (`YYYY-MM-DD`) or `null`. */
  readonly birthday = signal<string | null>(DEFAULT_PROFILE.birthday);
  readonly gender = signal<Gender | null>(DEFAULT_PROFILE.gender);
  readonly weightKg = signal(DEFAULT_PROFILE.weightKg);
  readonly heightCm = signal(DEFAULT_PROFILE.heightCm);
  readonly stepsPerDay = signal(DEFAULT_PROFILE.stepsPerDay);
  /** Seven flags, Monday first. Toggle one with `toggleTrainingDay`. */
  readonly trainingDays = signal<readonly boolean[]>(DEFAULT_PROFILE.trainingDays);
  readonly trainingMinutes = signal(DEFAULT_PROFILE.trainingMinutes);
  readonly trainingRpe = signal<number | null>(DEFAULT_PROFILE.trainingRpe);
  readonly goal = signal<GoalId | null>(DEFAULT_PROFILE.goal);
  readonly goalWeightKg = signal(DEFAULT_PROFILE.goalWeightKg);
  readonly pace = signal<PaceId | null>(DEFAULT_PROFILE.pace);
  /** `null` = not answered yet. The design starts on "Yes please". */
  readonly notifications = signal<boolean | null>(DEFAULT_PROFILE.notificationsEnabled);
  readonly email = signal('');
  readonly termsAccepted = signal(false);

  private readonly stepState = signal<SignupStepId>(FIRST_STEP);
  private readonly editFromState = signal<SignupStepId | null>(null);

  readonly step: Signal<SignupStepId> = this.stepState.asReadonly();
  /** The step the summary sent the user to – otherwise `null`. */
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
  /** The goal weight clamped to the scale's bounds – design's `goalW`. */
  private readonly boundedGoalWeightKg = computed(() => {
    const bounds = this.calculator.goalWeightBounds(this.goal(), this.weightKg());
    return clamp(this.goalWeightKg(), bounds.min, bounds.max);
  });

  /** Design's `visOrder`: the order without the steps the user's answers make redundant. */
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
    return CHAPTER_DEFINITIONS.map(({ labelKey, steps }) => {
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
      return { label: this.t(labelKey), flex: visible.length, pct, active: index >= 0, done };
    });
  });

  /** Design's `canNext` – one expression per step. */
  readonly canContinue = computed(() => {
    switch (this.stepState()) {
      case 'account': {
        const username = this.username().trim().length;
        const password = this.password().length;
        return (
          username >= USERNAME_MIN_LENGTH &&
          username <= USERNAME_MAX_LENGTH &&
          password >= PASSWORD_MIN_LENGTH &&
          password <= PASSWORD_MAX_LENGTH &&
          this.password() === this.passwordRepeat()
        );
      }
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
      case 'goal-weight': {
        const goal = this.goal();
        const goalKg = this.boundedGoalWeightKg();
        // The API only takes a goal weight on the goal's side of the current weight – the scale's
        // bounds alone can't guarantee that at the extremes (≤ 36 kg to lose, ≥ 200 kg to gain).
        const onGoalSide =
          goal === 'tabe' ? goalKg < this.weightKg() : goal !== 'tage' || goalKg > this.weightKg();
        return onGoalSide && this.calculator.isGoalWeightRealistic(goal, goalKg, this.heightCm());
      }
      case 'pace':
        return this.pace() !== null;
      case 'notifications':
        return this.notifications() !== null;
      case 'summary':
        return this.calculator.isValidEmail(this.email()) && this.termsAccepted();
    }
  });

  /** Design's `calcNext`: the next visible step. */
  private readonly nextStep = computed<SignupStepId | null>(() => this.neighbour(1));

  private readonly editChain = computed<readonly SignupStepId[]>(() => {
    const from = this.editFromState();
    if (from === null || !this.isEditing()) {
      return [];
    }
    return EDIT_CHAINS[from] ?? [from];
  });

  /** Design's `nextIsSave`: while editing, if the next step leaves the edit chain, the button reads "Save". */
  private readonly nextIsSave = computed(() => {
    if (!this.isEditing()) {
      return false;
    }
    const next = this.nextStep();
    return next === null || !this.editChain().includes(next);
  });

  readonly nextLabel = computed(() => {
    if (this.stepState() === SUMMARY_STEP) {
      return this.t(SUBMIT_LABEL_KEY);
    }
    return this.t(this.nextIsSave() ? SAVE_LABEL_KEY : NEXT_LABEL_KEY);
  });

  /**
   * Advances. Nothing happens on the summary – there the button reads "Create account", and the
   * page calls `submit()` itself, since it needs to show a spinner and errors.
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

  /** Back one step. From the first step, out of the flow; mid-edit, back to the summary. */
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

  /** Design's `jumpEdit`: the summary sends the user into a step in edit mode. */
  jumpTo(step: SignupStepId): void {
    this.stepState.set(step);
    this.editFromState.set(step);
  }

  toggleTrainingDay(index: number): void {
    this.trainingDays.update((days) => days.map((on, i) => (i === index ? !on : on)));
  }

  /**
   * Creates the account: `SessionService.register()` sends the draft to the API, which e-mails
   * the verification code, and the session waits for it (`pending-verification`), so Home shows
   * the verification sheet. The draft is written as the local profile only once the API has
   * created the account.
   */
  submit(): Observable<void> {
    const profile = this.toProfile();
    return this.session
      .register(profile, this.password(), this.passwordRepeat())
      .pipe(tap(() => this.profiles.replace(profile)));
  }

  /**
   * The neighbour in `visibleOrder` (`+1` forward, `-1` backward) – this way the skip rules are
   * described in only one place. If the active step itself has been hidden by a later answer,
   * the nearest visible neighbour is found from the fixed order instead.
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
      photo: null,
    };
  }
}
