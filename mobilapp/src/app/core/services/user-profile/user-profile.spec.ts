import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { UserDto } from '../../models/auth';
import {
  LatestWeightDto,
  UserGoalDto,
  UserProfileDto,
  UserSettingDto,
} from '../../models/profile-api';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { TEST_AUTH_RESPONSE, TEST_GOAL } from '../../testing/fixtures';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { injectTranslate } from '../language/translate';
import { UserProfileService } from './user-profile';

const URL = {
  ME: '/api/v1/me',
  PROFILE: '/api/v1/me/profile',
  GOALS: '/api/v1/me/goals',
  CURRENT_GOAL: '/api/v1/me/goals/current',
  RECALCULATE: '/api/v1/me/goals/recalculate',
  SETTINGS: '/api/v1/me/settings',
  NOTIFICATIONS: '/api/v1/me/settings/Notifications',
  LATEST_WEIGHT: '/api/v1/me/weight-logs/latest',
} as const;

const USER: UserDto = { ...TEST_AUTH_RESPONSE.user, username: 'anna', email: 'anna@nutrify.dk' };
const PROFILE_DTO: UserProfileDto = {
  userProfileId: 3,
  userId: 1,
  birthDate: '1998-05-16',
  gender: 'Female',
  height: 168,
  startingWeight: 72,
  dailySteps: 8000,
  trainingDaysPerWeek: 3,
  workoutDurationMinutes: 45,
  trainingIntensity: 'High',
  timeZoneId: 'Europe/Copenhagen',
  profileImageUrl: null,
};
const SETTINGS: UserSettingDto[] = [
  { settingKey: 'Notifications', settingValue: 'false', updatedAt: '2026-09-01T07:55:00Z' },
];
const LATEST: LatestWeightDto = {
  weightLogId: 12,
  weight: 71.4,
  recordedAt: '2026-09-20T06:00:00Z',
  isStartingWeight: false,
};
const MAINTAIN_GOAL: UserGoalDto = {
  ...TEST_GOAL,
  userGoalId: 8,
  goalType: 'MaintainWeight',
  targetWeight: 71.4,
  weightChangePerWeek: 0,
  targetDailyCalories: 2210.6,
  targetProtein: 165.8,
  targetCarbohydrates: 221.06,
  targetFat: 73.69,
};
const CREATED = { status: 201, statusText: 'Created' };
const CONFLICT = { status: 409, statusText: 'Conflict' };
const BAD_REQUEST = { status: 400, statusText: 'Bad Request' };
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };

describe('UserProfileService', () => {
  let storage: FakeStorage;
  let http: HttpTestingController;

  function setup(): UserProfileService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(UserProfileService);
  }

  /** Answers the five calls of `load()`; `goal` is the recalculation's answer. */
  function flushLoad(goal: UserGoalDto = TEST_GOAL): void {
    http.expectOne({ method: 'GET', url: URL.ME }).flush(USER);
    http.expectOne({ method: 'GET', url: URL.PROFILE }).flush(PROFILE_DTO);
    http.expectOne({ method: 'POST', url: URL.RECALCULATE }).flush(goal);
    http.expectOne({ method: 'GET', url: URL.SETTINGS }).flush(SETTINGS);
    http.expectOne({ method: 'GET', url: URL.LATEST_WEIGHT }).flush(LATEST);
  }

  async function loaded(goal: UserGoalDto = TEST_GOAL): Promise<UserProfileService> {
    const service = setup();
    const done = firstValueFrom(service.load());
    flushLoad(goal);
    await done;
    return service;
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  afterEach(() => {
    http.verify();
    // Nothing of the profile is ever written to the device.
    expect(storage.data.size).toBe(0);
  });

  it('starts idle from the neutral defaults, with no goal and zero targets', () => {
    const service = setup();

    expect(service.status()).toBe('idle');
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.goal()).toBeNull();
    expect(service.targets()).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(service.calorieFloorApplied()).toBe(false);
    expect(service.displayName()).toBe('');
    expect(service.age()).toBe(0);
    expect(service.bmi()).toBe(23.7);
  });

  describe('load', () => {
    it('replaces the whole profile with the API data and recalculates the goal', async () => {
      const service = setup();
      const done = firstValueFrom(service.load());
      expect(service.status()).toBe('loading');

      flushLoad();
      await done;

      expect(service.status()).toBe('ready');
      expect(service.profile()).toEqual({
        username: 'anna',
        email: 'anna@nutrify.dk',
        birthday: '1998-05-16',
        gender: 'kvinde',
        weightKg: 71.4,
        heightCm: 168,
        stepsPerDay: 8000,
        trainingDays: [true, true, true, false, false, false, false],
        trainingMinutes: 45,
        trainingRpe: 9,
        goal: 'tabe',
        pace: 'moderat',
        goalWeightKg: 70,
        notificationsEnabled: false,
        photo: null,
      });
      expect(service.goal()).toEqual(TEST_GOAL);
      expect(service.targets()).toEqual({ kcal: 2500, protein: 188, carbs: 250, fat: 83 });
      expect(service.displayName()).toBe('anna');
      expect(service.age()).toBe(28);
    });

    it('falls back to the current goal when the recalculation fails', async () => {
      const service = setup();
      const done = firstValueFrom(service.load());

      http.expectOne(URL.ME).flush(USER);
      http.expectOne(URL.PROFILE).flush(PROFILE_DTO);
      http
        .expectOne({ method: 'POST', url: URL.RECALCULATE })
        .flush({ status: 404, detail: 'No goal exists to recalculate.' }, SERVER_ERROR);
      http.expectOne(URL.SETTINGS).flush(SETTINGS);
      http.expectOne(URL.LATEST_WEIGHT).flush(LATEST);
      http.expectOne({ method: 'GET', url: URL.CURRENT_GOAL }).flush(MAINTAIN_GOAL);
      await done;

      expect(service.status()).toBe('ready');
      expect(service.goal()).toEqual(MAINTAIN_GOAL);
      expect(service.profile()).toMatchObject({ goal: 'hold', pace: null, goalWeightKg: 71.4 });
      expect(service.targets().kcal).toBe(2211);
    });

    it('sets status "error" without throwing and keeps the old profile when a call fails', async () => {
      const service = setup();
      const done = firstValueFrom(service.load());

      http.expectOne(URL.PROFILE).flush(PROFILE_DTO);
      http.expectOne(URL.RECALCULATE).flush(TEST_GOAL);
      http.expectOne(URL.SETTINGS).flush(SETTINGS);
      http.expectOne(URL.LATEST_WEIGHT).flush(LATEST);
      http.expectOne(URL.ME).flush(null, SERVER_ERROR);
      await expect(done).resolves.toBeUndefined();

      expect(service.status()).toBe('error');
      expect(service.profile()).toEqual(DEFAULT_PROFILE);
    });

    it('turns notifications on when the setting is missing and maps a photo URL', async () => {
      const service = setup();
      const done = firstValueFrom(service.load());

      http.expectOne(URL.ME).flush(USER);
      http
        .expectOne(URL.PROFILE)
        .flush({ ...PROFILE_DTO, profileImageUrl: '/api/v1/dev-images/a.jpg' });
      http.expectOne(URL.RECALCULATE).flush(TEST_GOAL);
      http.expectOne(URL.SETTINGS).flush([]);
      http.expectOne(URL.LATEST_WEIGHT).flush(LATEST);
      await done;

      expect(service.profile().notificationsEnabled).toBe(true);
      expect(service.profile().photo).toEqual({
        dataUrl: '/api/v1/dev-images/a.jpg',
        aspectRatio: 1,
        zoom: 1,
        x: 50,
        y: 50,
      });
    });
  });

  it('tells when the API lifted the target to the safe minimum for the gender', async () => {
    const service = await loaded({ ...TEST_GOAL, targetDailyCalories: 1200 });

    expect(service.calorieFloorApplied()).toBe(true);

    service.update({ gender: 'mand' });
    expect(service.calorieFloorApplied()).toBe(false);

    service.update({ gender: null });
    expect(service.calorieFloorApplied()).toBe(true);
  });

  it('reset forgets the profile, the goal and the status – memory only', async () => {
    const service = await loaded();

    service.reset();

    expect(service.status()).toBe('idle');
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.goal()).toBeNull();
    expect(service.targets().kcal).toBe(0);
  });

  describe('save', () => {
    it('PATCHes profile fields in the API shape, then reloads the recalculated goal', async () => {
      const service = await loaded();

      const done = firstValueFrom(
        service.save({
          heightCm: 170,
          birthday: '1990-01-02',
          gender: 'mand',
          stepsPerDay: 9000,
          trainingDays: [true, true, false, false, false, false, false],
          trainingMinutes: 60,
          trainingRpe: 3,
        }),
      );
      const patch = http.expectOne({ method: 'PATCH', url: URL.PROFILE });
      expect(patch.request.body).toEqual({
        height: 170,
        birthDate: '1990-01-02',
        gender: 'Male',
        dailySteps: 9000,
        trainingDaysPerWeek: 2,
        workoutDurationMinutes: 60,
        trainingIntensity: 'Low',
      });
      // Pessimistic: nothing changes before the API has answered.
      expect(service.profile().heightCm).toBe(168);
      patch.flush({ ...PROFILE_DTO, height: 170, gender: 'Male', trainingIntensity: 'Low' });
      http.expectOne({ method: 'GET', url: URL.CURRENT_GOAL }).flush(MAINTAIN_GOAL);
      await done;

      expect(service.profile()).toMatchObject({ heightCm: 170, gender: 'mand', trainingRpe: 3 });
      expect(service.goal()).toEqual(MAINTAIN_GOAL);
    });

    it('keeps the profile when the API rejects the age', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ birthday: '2020-01-01' }));
      http
        .expectOne({ method: 'PATCH', url: URL.PROFILE })
        .flush({ status: 400, detail: 'Age must be between 13 and 100 years.' }, BAD_REQUEST);

      await expect(done).rejects.toEqual({ messageKey: 'common.error.requestFailed', status: 400 });
      expect(service.profile().birthday).toBe('1998-05-16');
    });

    it('POSTs a lose goal with the goal weight and the moderate pace when none is chosen', async () => {
      const service = await loaded();
      service.update({ pace: null });
      const created: UserGoalDto = { ...TEST_GOAL, userGoalId: 9, targetWeight: 65 };

      const done = firstValueFrom(service.save({ goal: 'tabe', goalWeightKg: 65 }));
      const request = http.expectOne({ method: 'POST', url: URL.GOALS });
      expect(request.request.body).toEqual({
        goalType: 'LoseWeight',
        targetWeight: 65,
        weightChangePerWeek: 0.5,
      });
      request.flush(created, CREATED);
      await done;

      expect(service.goal()).toEqual(created);
      expect(service.profile()).toMatchObject({ goal: 'tabe', pace: 'moderat', goalWeightKg: 65 });
    });

    it('POSTs "hold" with the current weight and pace 0', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ goal: 'hold' }));
      const request = http.expectOne({ method: 'POST', url: URL.GOALS });
      expect(request.request.body).toEqual({
        goalType: 'MaintainWeight',
        targetWeight: 71.4,
        weightChangePerWeek: 0,
      });
      request.flush(MAINTAIN_GOAL, CREATED);
      await done;

      expect(service.profile().goal).toBe('hold');
    });

    it('treats 409 (the goal already matches) as success', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ pace: 'hurtig' }));
      const request = http.expectOne({ method: 'POST', url: URL.GOALS });
      expect(request.request.body).toEqual({
        goalType: 'LoseWeight',
        targetWeight: 70,
        weightChangePerWeek: 1,
      });
      request.flush(
        { status: 409, detail: 'The current goal already matches these choices.' },
        CONFLICT,
      );
      await expect(done).resolves.toBeUndefined();

      expect(service.profile().pace).toBe('hurtig');
      expect(service.goal()).toEqual(TEST_GOAL);
    });

    it('fails with an ApiError and changes nothing when the API rejects the goal', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ goal: 'tage', goalWeightKg: 60 }));
      http
        .expectOne(URL.GOALS)
        .flush(
          { status: 400, detail: 'Target weight and change pace must match the selected goal.' },
          BAD_REQUEST,
        );

      await expect(done).rejects.toEqual({ messageKey: 'common.error.requestFailed', status: 400 });
      expect(service.profile()).toMatchObject({ goal: 'tabe', goalWeightKg: 70 });
    });

    it('PUTs the notifications setting', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ notificationsEnabled: true }));
      const request = http.expectOne({ method: 'PUT', url: URL.NOTIFICATIONS });
      expect(request.request.body).toEqual({ value: 'true' });
      request.flush({ settingKey: 'Notifications', settingValue: 'true', updatedAt: '' });
      await done;

      expect(service.profile().notificationsEnabled).toBe(true);
    });

    it('PATCHes the e-mail on the account and keeps the current one until the link is tapped', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ email: 'ny@nutrify.dk' }));
      const request = http.expectOne({ method: 'PATCH', url: URL.ME });
      expect(request.request.body).toEqual({ email: 'ny@nutrify.dk' });
      request.flush(USER);
      await done;

      expect(service.profile().email).toBe('anna@nutrify.dk');
    });

    it('maps a taken e-mail to the register key', async () => {
      const service = await loaded();

      const done = firstValueFrom(service.save({ email: 'taget@nutrify.dk' }));
      http
        .expectOne(URL.ME)
        .flush({ status: 409, detail: 'An account with that email already exists.' }, CONFLICT);

      await expect(done).rejects.toEqual({ messageKey: 'core.auth.error.emailTaken', status: 409 });
    });
  });

  it('reloadGoal fetches the current goal', async () => {
    const service = await loaded();

    const done = firstValueFrom(service.reloadGoal());
    http.expectOne({ method: 'GET', url: URL.CURRENT_GOAL }).flush(MAINTAIN_GOAL);
    await done;

    expect(service.goal()).toEqual(MAINTAIN_GOAL);
    expect(service.profile().goal).toBe('hold');
  });

  it('update and replace change memory only', () => {
    const service = setup();
    const t = TestBed.runInInjectionContext(() => injectTranslate());

    service.update({ username: 'bo', weightKg: 90 });
    expect(service.profile()).toMatchObject({ username: 'bo', weightKg: 90 });

    service.replace({ ...DEFAULT_PROFILE, goal: 'tage', pace: 'rolig' });
    expect(t(service.goalDefinition()?.labelKey ?? '')).toBe('Tage på');
    expect(t(service.paceDefinition()?.rateLabelKey ?? '')).toBe('0,25 kg/uge');

    service.resetToDefaults();
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
  });
});
