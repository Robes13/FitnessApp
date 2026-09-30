import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_PATH } from '../../../core/constants/app-route';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { SessionService } from '../../../core/services/session/session';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { SIGNUP_STEP_ORDER, SignupStateService, SignupStepId } from './signup-state';

/** The fixed "now" in tests is Monday, September 21, 2026 – see `provideCoreTestEnvironment`. */
const BIRTHDAY_ADULT = '1998-05-16';
const BIRTHDAY_CHILD = '2015-01-01';
const NO_TRAINING_DAYS: readonly boolean[] = [false, false, false, false, false, false, false];
/** Monday, Wednesday and Friday – the draft starts with no days selected, so tests set them themselves. */
const TRAINING_DAYS: readonly boolean[] = [true, false, true, false, true, false, false];

describe('SignupStateService', () => {
  let storage: FakeStorage;

  function setup(): SignupStateService {
    TestBed.configureTestingModule({
      providers: [provideCoreTestEnvironment({ storage }), provideRouter([]), SignupStateService],
    });
    return TestBed.inject(SignupStateService);
  }

  /** Fills in all fields so every step can be passed. */
  function fillDraft(state: SignupStateService): void {
    state.username.set('mads');
    state.password.set('hemmelig1');
    state.passwordRepeat.set('hemmelig1');
    state.birthday.set(BIRTHDAY_ADULT);
    state.gender.set('mand');
    state.trainingDays.set(TRAINING_DAYS);
    state.trainingRpe.set(6);
    state.goal.set('tabe');
    state.pace.set('moderat');
    state.email.set('mads@nutrify.dk');
    state.termsAccepted.set(true);
  }

  /** Fills the draft and jumps directly to `step` (edit mode does not matter here). */
  function at(state: SignupStateService, step: SignupStepId): void {
    fillDraft(state);
    state.jumpTo(step);
  }

  /** Fills the draft and advances to `step` with `next()`, so edit mode stays clean. */
  function fill(state: SignupStateService, step: SignupStepId): void {
    fillDraft(state);
    while (state.step() !== step) {
      const before = state.step();
      state.next();
      if (state.step() === before) {
        throw new Error(`Trinnet ${step} kan ikke nås`);
      }
    }
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts on the first step with the design order', () => {
    const state = setup();

    expect(state.step()).toBe('account');
    expect(state.stepNumber()).toBe(1);
    expect(SIGNUP_STEP_ORDER).toEqual([
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
    ]);
    // The draft starts with no training days, so the two training detail steps are hidden from the start.
    expect(state.visibleOrder()).not.toContain('training-duration');
    expect(state.stepTotal()).toBe(12);
    expect(state.isEditing()).toBe(false);

    state.trainingDays.set(TRAINING_DAYS);

    expect(state.visibleOrder()).toEqual(SIGNUP_STEP_ORDER);
    expect(state.stepTotal()).toBe(14);
  });

  describe('skip rules', () => {
    it('drops the two training detail steps when no day is selected', () => {
      const state = setup();

      state.trainingDays.set(NO_TRAINING_DAYS);

      expect(state.visibleOrder()).not.toContain('training-duration');
      expect(state.visibleOrder()).not.toContain('training-intensity');
      expect(state.stepTotal()).toBe(12);
    });

    it('drops goal weight and pace when the goal is "hold"', () => {
      const state = setup();

      state.trainingDays.set(TRAINING_DAYS);
      state.goal.set('hold');

      expect(state.visibleOrder()).not.toContain('goal-weight');
      expect(state.visibleOrder()).not.toContain('pace');
      expect(state.stepTotal()).toBe(12);
    });

    it('keeps goal weight and pace for the other goals', () => {
      const state = setup();

      state.trainingDays.set(TRAINING_DAYS);
      state.goal.set('tage');

      expect(state.visibleOrder()).toContain('goal-weight');
      expect(state.visibleOrder()).toContain('pace');
    });

    it('jumps from training frequency to goal when no day is selected', () => {
      const state = setup();
      fill(state, 'training-frequency');

      state.trainingDays.set(NO_TRAINING_DAYS);
      state.next();

      expect(state.step()).toBe('goal');
    });

    it('keeps the notifications step when the goal is "hold"', () => {
      const state = setup();
      fill(state, 'goal');

      state.goal.set('hold');
      state.next();

      expect(state.step()).toBe('notifications');

      state.next();

      expect(state.step()).toBe('summary');
    });

    it('walks back over the skipped steps', () => {
      const state = setup();
      fill(state, 'notifications');

      state.goal.set('hold');
      state.back();

      expect(state.step()).toBe('goal');
    });

    it('walks back from goal to training frequency when no day is selected', () => {
      const state = setup();
      fill(state, 'goal');

      state.trainingDays.set(NO_TRAINING_DAYS);
      state.back();

      expect(state.step()).toBe('training-frequency');
    });
  });

  describe('canContinue', () => {
    it('requires a 3-50 character ASCII username without whitespace', () => {
      const state = setup();
      state.password.set('hemmelig1');
      state.passwordRepeat.set('hemmelig1');
      for (const username of ['ab', 'a'.repeat(51), 'has space', ' leading', 'a@b', 'mads\n']) {
        state.username.set(username);
        expect(state.canContinue()).toBe(false);
      }
      for (const username of ['JohnDoe', 'john_doe', 'john-doe', 'a'.repeat(50)]) {
        state.username.set(username);
        expect(state.canContinue()).toBe(true);
      }
    });

    it('requires a username and two matching passwords of at least eight characters', () => {
      const state = setup();

      expect(state.canContinue()).toBe(false);

      state.username.set('mads');
      state.password.set('kort');
      state.passwordRepeat.set('kort');

      expect(state.canContinue()).toBe(false);

      state.password.set('hemmelig1');
      state.passwordRepeat.set('hemmelig2');

      expect(state.canContinue()).toBe(false);

      state.passwordRepeat.set('hemmelig1');

      expect(state.canContinue()).toBe(true);
    });

    it('requires an age between 16 and 120', () => {
      const state = setup();
      at(state, 'birthday');

      state.birthday.set(null);

      expect(state.canContinue()).toBe(false);

      state.birthday.set(BIRTHDAY_CHILD);

      expect(state.canContinue()).toBe(false);

      state.birthday.set(BIRTHDAY_ADULT);

      expect(state.canContinue()).toBe(true);
    });

    it('requires a gender, an intensity, a goal and a pace', () => {
      const state = setup();

      at(state, 'gender');
      state.gender.set(null);
      expect(state.canContinue()).toBe(false);
      state.gender.set('kvinde');
      expect(state.canContinue()).toBe(true);

      at(state, 'training-intensity');
      state.trainingRpe.set(null);
      expect(state.canContinue()).toBe(false);
      state.trainingRpe.set(9);
      expect(state.canContinue()).toBe(true);

      at(state, 'goal');
      state.goal.set(null);
      expect(state.canContinue()).toBe(false);
      state.goal.set('tage');
      expect(state.canContinue()).toBe(true);

      at(state, 'pace');
      state.pace.set(null);
      expect(state.canContinue()).toBe(false);
      state.pace.set('rolig');
      expect(state.canContinue()).toBe(true);
    });

    it('lets the free steps through and blocks an unrealistic goal weight', () => {
      const state = setup();

      at(state, 'weight');
      expect(state.canContinue()).toBe(true);
      at(state, 'height');
      expect(state.canContinue()).toBe(true);
      at(state, 'activity');
      expect(state.canContinue()).toBe(true);
      at(state, 'training-frequency');
      expect(state.canContinue()).toBe(true);
      at(state, 'training-duration');
      expect(state.canContinue()).toBe(true);

      at(state, 'goal-weight');
      state.goal.set('tabe');
      state.goalWeightKg.set(40);

      expect(state.canContinue()).toBe(false);

      state.goalWeightKg.set(70);

      expect(state.canContinue()).toBe(true);
    });

    it('requires an answer on notifications and a valid e-mail plus terms on the summary', () => {
      const state = setup();

      at(state, 'notifications');
      state.notifications.set(null);
      expect(state.canContinue()).toBe(false);
      state.notifications.set(false);
      expect(state.canContinue()).toBe(true);

      at(state, 'summary');
      state.email.set('ikke-en-mail');
      expect(state.canContinue()).toBe(false);
      state.email.set('mads@nutrify.dk');
      state.termsAccepted.set(false);
      expect(state.canContinue()).toBe(false);
      state.termsAccepted.set(true);
      expect(state.canContinue()).toBe(true);
    });
  });

  describe('nextLabel', () => {
    it('says "Næste" while walking forward and "Opret konto" on the summary', () => {
      const state = setup();
      fill(state, 'account');

      expect(state.nextLabel()).toBe('Næste');

      fill(state, 'summary');

      expect(state.step()).toBe('summary');
      expect(state.nextLabel()).toBe('Opret konto');
    });

    it('says "Gem" on the last step of an edit chain', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('gender');

      expect(state.isEditing()).toBe(true);
      expect(state.nextLabel()).toBe('Gem');

      state.jumpTo('training-frequency');

      expect(state.nextLabel()).toBe('Næste');
    });
  });

  describe('edit chains', () => {
    it('returns to the summary from a single-step edit', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('weight');
      state.next();

      expect(state.step()).toBe('summary');
      expect(state.isEditing()).toBe(false);
      expect(state.editFrom()).toBeNull();
    });

    it('walks the training chain before returning to the summary', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('training-frequency');
      state.next();
      expect(state.step()).toBe('training-duration');

      state.next();
      expect(state.step()).toBe('training-intensity');

      state.next();
      expect(state.step()).toBe('summary');
      expect(state.isEditing()).toBe(false);
    });

    it('walks the goal chain and honours the skip rules inside it', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('goal');
      state.goal.set('hold');
      state.next();

      expect(state.step()).toBe('summary');
    });

    it('goes back to the summary when back() leaves the edit chain', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('gender');
      state.back();

      expect(state.step()).toBe('summary');
      expect(state.editFrom()).toBeNull();
    });

    it('goes back to the summary from the very first step while editing', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('account');
      state.back();

      expect(state.step()).toBe('summary');
    });

    it('stays inside the chain when back() leads to a chain step', () => {
      const state = setup();
      fill(state, 'summary');

      state.jumpTo('training-frequency');
      state.next();
      state.back();

      expect(state.step()).toBe('training-frequency');
      expect(state.isEditing()).toBe(true);
    });
  });

  it('leaves the flow when back() is pressed on the first step', () => {
    const state = setup();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    state.back();

    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
    expect(state.step()).toBe('account');
  });

  it('toggles a single training day without touching the others', () => {
    const state = setup();

    state.trainingDays.set(TRAINING_DAYS);
    state.toggleTrainingDay(1);

    expect(state.trainingDays()).toEqual([true, true, true, false, true, false, false]);
  });

  describe('chapters', () => {
    it('gives every chapter its flex, marks the active one and fills the finished ones', () => {
      const state = setup();
      fill(state, 'activity');

      const chapters = state.chapters();

      expect(chapters.map((chapter) => chapter.label)).toEqual([
        'Dig',
        'Aktivitet',
        'Mål',
        'Afslut',
      ]);
      expect(chapters.map((chapter) => chapter.flex)).toEqual([5, 4, 3, 2]);
      expect(chapters[0]).toMatchObject({ pct: 100, active: false, done: true });
      expect(chapters[1]).toMatchObject({ pct: 25, active: true, done: false });
      expect(chapters[3]).toMatchObject({ pct: 0, active: false, done: false });
    });

    it('shrinks a chapter when its steps are skipped', () => {
      const state = setup();

      state.trainingDays.set(TRAINING_DAYS);
      state.goal.set('hold');

      expect(state.chapters()[2]).toMatchObject({ label: 'Mål', flex: 1 });
    });
  });

  it('tracks the progress value as the step number over the total', () => {
    const state = setup();
    fill(state, 'account');

    expect(state.progressValue()).toBeCloseTo(1 / 14);

    state.next();

    expect(state.progressValue()).toBeCloseTo(2 / 14);
  });

  describe('submit', () => {
    it('registers, writes the trimmed draft as the profile and logs in unverified', async () => {
      const state = setup();
      fill(state, 'summary');
      state.username.set('  Mads  ');
      state.email.set('  mads@nutrify.dk  ');

      await firstValueFrom(state.submit());

      const profile = TestBed.inject(UserProfileService).profile();
      expect(profile.username).toBe('Mads');
      expect(profile.email).toBe('mads@nutrify.dk');
      expect(TestBed.inject(SessionService).isLoggedIn()).toBe(true);
      expect(TestBed.inject(SessionService).isEmailVerified()).toBe(false);
      expect(storage.getItem(STORAGE_KEY.PROFILE)).not.toBeNull();
    });
  });
});
