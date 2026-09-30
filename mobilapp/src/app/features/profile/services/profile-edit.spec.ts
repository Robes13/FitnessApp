import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { TEST_GOAL } from '../../../core/testing/fixtures';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import {
  DateEditDefinition,
  NumberEditDefinition,
  OptionsEditDefinition,
  ProfileEditService,
} from './profile-edit';

const GOALS_URL = '/api/v1/me/goals';
const PROFILE_URL = '/api/v1/me/profile';
const CURRENT_GOAL_URL = '/api/v1/me/goals/current';
const CREATED = { status: 201, statusText: 'Created' };

interface Run<T> {
  readonly values: T[];
  done: boolean;
}

/** Subscribes and records what the observable emits and whether it completed. */
function run<T>(source: Observable<T>): Run<T> {
  const result: Run<T> = { values: [], done: false };
  source.subscribe({
    next: (value) => result.values.push(value),
    complete: () => (result.done = true),
  });
  return result;
}

describe('ProfileEditService', () => {
  let http: HttpTestingController;

  function setup(): { editor: ProfileEditService; profiles: UserProfileService } {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    http = TestBed.inject(HttpTestingController);
    return {
      editor: TestBed.inject(ProfileEditService),
      profiles: TestBed.inject(UserProfileService),
    };
  }

  /** Answers the `PATCH me/profile` of a save and the goal reload after it. */
  function flushProfilePatch(body: unknown, dto: object = {}): void {
    const patch = http.expectOne({ method: 'PATCH', url: PROFILE_URL });
    expect(patch.request.body).toEqual(body);
    patch.flush({
      birthDate: '1998-05-16',
      gender: 'Female',
      height: 178,
      dailySteps: 6000,
      trainingDaysPerWeek: 0,
      workoutDurationMinutes: 45,
      trainingIntensity: 'Moderate',
      profileImageUrl: null,
      ...dto,
    });
    http.expectOne(CURRENT_GOAL_URL).flush(TEST_GOAL);
  }

  afterEach(() => http.verify());

  it('describes the goal row as a list of options with none selected yet', () => {
    const { editor } = setup();
    const definition = editor.definitionFor('goal') as OptionsEditDefinition;

    expect(definition.title).toBe('Dit mål');
    expect(definition.kind).toBe('options');
    expect(definition.selectedId).toBeNull();
    expect(definition.options.map((option) => option.label)).toEqual([
      'Tabe mig',
      'Holde vægten',
      'Tage på',
    ]);
  });

  it('puts the rate in front of the pace description', () => {
    const { editor } = setup();
    const definition = editor.definitionFor('pace') as OptionsEditDefinition;

    expect(definition.options.map((option) => option.description)).toContain(
      '0,5 kg/uge · Anbefalet for de fleste',
    );
  });

  it('seeds number rows with the current value and the design bounds', () => {
    const { editor } = setup();
    const height = editor.definitionFor('height') as NumberEditDefinition;

    expect(height).toMatchObject({ kind: 'number', unit: 'cm', min: 120, max: 230, step: 1 });
    expect(height.value).toBe(178);
  });

  it('describes the birthday as a date between the ages 13 and 100', () => {
    const { editor, profiles } = setup();

    expect(editor.definitionFor('birthday')).toMatchObject({
      kind: 'date',
      title: 'Fødselsdato',
      value: '',
      min: '1925-09-22',
      max: '2013-09-21',
    });

    profiles.update({ birthday: '1998-05-16' });
    expect((editor.definitionFor('birthday') as DateEditDefinition).value).toBe('1998-05-16');
    expect(editor.isBirthdayValid('2013-09-21')).toBe(true);
    expect(editor.isBirthdayValid('2013-09-22')).toBe(false);
    expect(editor.isBirthdayValid('1925-09-21')).toBe(false);
    expect(editor.isBirthdayValid('')).toBe(false);
  });

  it('shows the current weight as a hint on the goal weight row', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 74.5 });

    expect(editor.definitionFor('goalWeight').hint).toBe('Nu: 74,5 kg');
  });

  it('saves an option through the API and only then changes the profile', () => {
    const { editor, profiles } = setup();

    const goal = run(editor.applyOption('goal', 'tabe'));
    const request = http.expectOne({ method: 'POST', url: GOALS_URL });
    expect(request.request.body).toEqual({
      goalType: 'LoseWeight',
      targetWeight: 70,
      weightChangePerWeek: 0.5,
    });
    expect(profiles.profile().goal).toBeNull();
    request.flush(TEST_GOAL, CREATED);
    expect(goal.values).toEqual([{ kind: 'saved' }]);
    expect(profiles.profile().goal).toBe('tabe');

    run(editor.applyOption('gender', 'kvinde'));
    flushProfilePatch({ gender: 'Female' });
    expect(profiles.profile().gender).toBe('kvinde');

    run(editor.applyOption('trainInt', 'haardt'));
    flushProfilePatch({ trainingIntensity: 'High' }, { trainingIntensity: 'High' });
    expect(profiles.profile().trainingRpe).toBe(9);
  });

  it('sends nothing for an option id that is not in the list', () => {
    const { editor, profiles } = setup();

    const result = run(editor.applyOption('goal', 'noget-andet'));

    expect(result).toEqual({ values: [], done: true });
    expect(profiles.profile().goal).toBeNull();
  });

  it('bounds the goal weight row by the goal, like the sign-up scale', () => {
    const { editor, profiles } = setup();

    profiles.update({ goal: 'tabe', weightKg: 75 });
    expect(editor.definitionFor('goalWeight')).toMatchObject({ min: 35, max: 74 });

    profiles.update({ goal: 'tage', goalWeightKg: 80 });
    expect(editor.definitionFor('goalWeight')).toMatchObject({ min: 76, max: 200 });
  });

  it('requires a goal weight below today when losing and above today when gaining', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 75, heightCm: 178 });

    expect(editor.goalWeightError(75, 'tabe')).toBe(
      'Målvægten skal være under din nuværende vægt (75 kg).',
    );
    expect(editor.goalWeightError(70, 'tabe')).toBeNull();
    expect(editor.goalWeightError(75, 'tage')).toBe(
      'Målvægten skal være over din nuværende vægt (75 kg).',
    );
    expect(editor.goalWeightError(80, 'tage')).toBeNull();
    expect(editor.goalWeightError(75, 'hold')).toBeNull();
  });

  it('blocks an unrealistic BMI with the sign-up warnings', () => {
    const { editor, profiles } = setup();
    profiles.update({ weightKg: 75, heightCm: 178 });

    // 178 cm: BMI 17 ≈ 53.9 kg, BMI 35 ≈ 110.9 kg.
    expect(editor.goalWeightError(50, 'tabe')).toBe('Det mål er for lavt for din højde.');
    expect(editor.goalWeightError(120, 'tage')).toBe('Det mål er meget højt for din højde.');
  });

  it('refuses to send a goal weight that breaks the current goal', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', pace: 'rolig', weightKg: 75, goalWeightKg: 70 });

    expect(run(editor.applyNumber('goalWeight', 80))).toEqual({ values: [], done: true });

    run(editor.applyNumber('goalWeight', 68));
    const request = http.expectOne({ method: 'POST', url: GOALS_URL });
    expect(request.request.body).toEqual({
      goalType: 'LoseWeight',
      targetWeight: 68,
      weightChangePerWeek: 0.25,
    });
    request.flush({ ...TEST_GOAL, targetWeight: 68, weightChangePerWeek: 0.25 }, CREATED);
    expect(profiles.profile().goalWeightKg).toBe(68);
  });

  it('holds back a goal change the stored goal weight no longer fits', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });

    expect(run(editor.applyOption('goal', 'tage')).values).toEqual([
      { kind: 'needs-goal-weight', goal: 'tage' },
    ]);
    expect(profiles.profile().goal).toBe('tabe');

    expect(run(editor.applyGoalWithGoalWeight('tage', 72)).values).toEqual([]);
    run(editor.applyGoalWithGoalWeight('tage', 80));
    const request = http.expectOne({ method: 'POST', url: GOALS_URL });
    expect(request.request.body).toEqual({
      goalType: 'GainWeight',
      targetWeight: 80,
      weightChangePerWeek: 0.5,
    });
    request.flush({ ...TEST_GOAL, goalType: 'GainWeight', targetWeight: 80 }, CREATED);
    expect(profiles.profile()).toMatchObject({ goal: 'tage', goalWeightKg: 80 });
  });

  it('switches to "hold" with the current weight, without asking for a goal weight', () => {
    const { editor, profiles } = setup();
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });

    run(editor.applyOption('goal', 'hold'));
    const request = http.expectOne({ method: 'POST', url: GOALS_URL });
    expect(request.request.body).toEqual({
      goalType: 'MaintainWeight',
      targetWeight: 75,
      weightChangePerWeek: 0,
    });
    request.flush(
      { ...TEST_GOAL, goalType: 'MaintainWeight', targetWeight: 75, weightChangePerWeek: 0 },
      CREATED,
    );
    expect(profiles.profile().goal).toBe('hold');
  });

  it('sends a training-day count, which the profile keeps as the first N weekdays', () => {
    const { editor, profiles } = setup();

    run(editor.applyNumber('trainFreq', 4));
    flushProfilePatch({ trainingDaysPerWeek: 4 }, { trainingDaysPerWeek: 4 });

    expect(profiles.profile().trainingDays).toEqual([true, true, true, true, false, false, false]);
  });

  it('sends a birthday only when the API would accept the age', () => {
    const { editor, profiles } = setup();

    expect(run(editor.applyBirthday('2015-01-01'))).toEqual({ values: [], done: true });

    const saved = run(editor.applyBirthday('1990-02-03'));
    flushProfilePatch({ birthDate: '1990-02-03' }, { birthDate: '1990-02-03' });

    expect(saved.done).toBe(true);
    expect(profiles.profile().birthday).toBe('1990-02-03');
  });

  it('trims the e-mail before sending it and keeps the current one', () => {
    const { editor, profiles } = setup();
    profiles.update({ email: 'gammel@mail.dk' });

    const saved = run(editor.applyEmail('  mads@mail.dk '));
    const request = http.expectOne({ method: 'PATCH', url: '/api/v1/me' });
    expect(request.request.body).toEqual({ email: 'mads@mail.dk' });
    request.flush({});

    expect(saved.done).toBe(true);
    expect(profiles.profile().email).toBe('gammel@mail.dk');
  });
});
