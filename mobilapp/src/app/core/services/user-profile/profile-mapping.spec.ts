import { ApiGender, ApiGoalType, ApiTrainingIntensity } from '../../models/auth';
import { UserProfileDto } from '../../models/profile-api';
import { TEST_AUTH_RESPONSE, TEST_GOAL } from '../../testing/fixtures';
import { GENDER_TO_API, GOAL_TO_API, INTENSITY_TO_API } from '../auth-api/auth-mapping';
import {
  GENDER_FROM_API,
  GOAL_FROM_API,
  INTENSITY_FROM_API,
  notificationsEnabledIn,
  paceIdFor,
  toGoalFields,
  toProfileFields,
  toProfilePhoto,
  toUserProfile,
  trainingDaysFor,
} from './profile-mapping';

/** `API_BASE_URL` in the browser (relative, through the dev proxy) and on Android. */
const BROWSER_API = '/api/v1';
const ANDROID_API = 'http://10.0.2.2:5210/api/v1';

const PROFILE_DTO: UserProfileDto = {
  userProfileId: 3,
  userId: 1,
  birthDate: '1998-05-16',
  gender: 'Male',
  height: 181.5,
  startingWeight: 80,
  dailySteps: 4000,
  trainingDaysPerWeek: 0,
  workoutDurationMinutes: 30,
  trainingIntensity: 'Moderate',
  timeZoneId: 'Europe/Copenhagen',
  profileImageUrl: null,
};

describe('profile mapping', () => {
  it('inverts every gender, goal and intensity table', () => {
    for (const [gender, api] of Object.entries(GENDER_TO_API)) {
      expect(GENDER_FROM_API[api]).toBe(gender);
    }
    for (const [goal, api] of Object.entries(GOAL_TO_API)) {
      expect(GOAL_FROM_API[api]).toBe(goal);
    }
    for (const [intensity, api] of Object.entries(INTENSITY_TO_API)) {
      expect(INTENSITY_FROM_API[api]).toBe(intensity);
    }
    expect(Object.keys(GOAL_FROM_API)).toHaveLength(Object.keys(GOAL_TO_API).length);
    expect(Object.keys(INTENSITY_FROM_API)).toHaveLength(Object.keys(INTENSITY_TO_API).length);
  });

  it('reads the API\'s "not chosen" genders and unknown values as null', () => {
    expect(GENDER_FROM_API.Unspecified).toBeNull();
    expect(GENDER_FROM_API.PreferNotToSay).toBeNull();
    expect(
      toProfileFields({ ...PROFILE_DTO, gender: 'Nope' as ApiGender }, BROWSER_API).gender,
    ).toBeNull();
    expect(
      toProfileFields(
        { ...PROFILE_DTO, trainingIntensity: 'Extreme' as ApiTrainingIntensity },
        BROWSER_API,
      ).trainingRpe,
    ).toBeNull();
    expect(toGoalFields({ ...TEST_GOAL, goalType: 'Other' as ApiGoalType }).goal).toBeNull();
  });

  it('maps the profile: intensity to its RPE, days to the first weekdays, a photo URL to a crop', () => {
    expect(toProfileFields(PROFILE_DTO, BROWSER_API)).toEqual({
      birthday: '1998-05-16',
      gender: 'mand',
      heightCm: 181.5,
      stepsPerDay: 4000,
      trainingDays: [false, false, false, false, false, false, false],
      trainingMinutes: 30,
      trainingRpe: 6,
      photo: null,
    });
    expect(
      toProfileFields({ ...PROFILE_DTO, trainingIntensity: 'Low' }, BROWSER_API).trainingRpe,
    ).toBe(3);
    expect(
      toProfileFields({ ...PROFILE_DTO, trainingIntensity: 'High' }, BROWSER_API).trainingRpe,
    ).toBe(9);
    expect(
      toProfileFields({ ...PROFILE_DTO, profileImageUrl: 'https://x/y.jpg' }, BROWSER_API).photo,
    ).toEqual({
      dataUrl: 'https://x/y.jpg',
      aspectRatio: 1,
      zoom: 1,
      x: 50,
      y: 50,
    });
  });

  // The http dev image is loaded through CapacitorHttp's proxy on the app's own origin: Android's
  // https WebView blocks it as mixed content when it is requested directly.
  it('loads a relative photo URL from the API through the native proxy, and nothing else', () => {
    const devImage = '/api/v1/dev-images/abc.jpg';
    const androidProxied =
      '/_capacitor_http_interceptor_?u=http%3A%2F%2F10.0.2.2%3A5210%2Fapi%2Fv1%2Fdev-images%2Fabc.jpg';

    expect(toProfilePhoto(devImage, ANDROID_API)?.dataUrl).toBe(androidProxied);
    expect(toProfilePhoto(devImage, 'http://localhost:5210/api/v1')?.dataUrl).toBe(
      '/_capacitor_http_interceptor_?u=http%3A%2F%2Flocalhost%3A5210%2Fapi%2Fv1%2Fdev-images%2Fabc.jpg',
    );
    expect(toProfilePhoto(devImage, BROWSER_API)?.dataUrl).toBe(devImage);
    expect(toProfilePhoto('https://blob.example/a.jpg?sv=1', ANDROID_API)?.dataUrl).toBe(
      'https://blob.example/a.jpg?sv=1',
    );
    expect(toProfilePhoto(null, ANDROID_API)).toBeNull();
    expect(
      toProfileFields({ ...PROFILE_DTO, profileImageUrl: devImage }, ANDROID_API).photo?.dataUrl,
    ).toBe(androidProxied);
  });

  it('turns a training-day count into the first N weekdays', () => {
    expect(trainingDaysFor(0)).toEqual([false, false, false, false, false, false, false]);
    expect(trainingDaysFor(3)).toEqual([true, true, true, false, false, false, false]);
    expect(trainingDaysFor(7)).toEqual([true, true, true, true, true, true, true]);
  });

  it('picks the nearest pace, none for maintaining', () => {
    expect(paceIdFor(0)).toBeNull();
    expect(paceIdFor(0.25)).toBe('rolig');
    expect(paceIdFor(0.3)).toBe('rolig');
    expect(paceIdFor(0.5)).toBe('moderat');
    expect(paceIdFor(0.8)).toBe('hurtig');
    expect(paceIdFor(1)).toBe('hurtig');
  });

  it('maps a goal, "MaintainWeight" to "hold"', () => {
    expect(toGoalFields(TEST_GOAL)).toEqual({ goal: 'tabe', pace: 'moderat', goalWeightKg: 70 });
    expect(
      toGoalFields({ goalType: 'MaintainWeight', targetWeight: 80, weightChangePerWeek: 0 }),
    ).toEqual({ goal: 'hold', pace: null, goalWeightKg: 80 });
    expect(
      toGoalFields({ goalType: 'GainWeight', targetWeight: 90, weightChangePerWeek: 0.25 }),
    ).toEqual({ goal: 'tage', pace: 'rolig', goalWeightKg: 90 });
  });

  it('reads the Notifications setting, on when it is missing', () => {
    const setting = (settingKey: string, settingValue: string) => ({
      settingKey,
      settingValue,
      updatedAt: '2026-09-01T07:55:00Z',
    });

    expect(notificationsEnabledIn([])).toBe(true);
    expect(notificationsEnabledIn([setting('Notifications', 'true')])).toBe(true);
    expect(notificationsEnabledIn([setting('Notifications', 'false')])).toBe(false);
    expect(notificationsEnabledIn([setting('Theme', 'false')])).toBe(true);
  });

  it('builds the whole profile: the account names it, the latest weigh-in weighs it', () => {
    const profile = toUserProfile(
      {
        user: TEST_AUTH_RESPONSE.user,
        profile: PROFILE_DTO,
        goal: TEST_GOAL,
        settings: [],
        latest: { weightLogId: null, weight: 80, recordedAt: '', isStartingWeight: true },
      },
      BROWSER_API,
    );

    expect(profile).toMatchObject({
      username: 'mads',
      email: 'mads@nutrify.dk',
      weightKg: 80,
      goal: 'tabe',
      notificationsEnabled: true,
    });
  });
});
