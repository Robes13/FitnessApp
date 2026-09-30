import { TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { STORAGE_KEY } from '../../constants/storage-key';
import { FakeStorage, createFakeStorage } from '../../testing/fake-document';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { injectTranslate } from '../language/translate';
import { UserProfileService } from './user-profile';

function translate(key: string): string {
  return TestBed.runInInjectionContext(() => injectTranslate())(key);
}

describe('UserProfileService', () => {
  let storage: FakeStorage;

  function setup(): UserProfileService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(UserProfileService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts from the neutral defaults with no name yet', () => {
    const service = setup();

    expect(service.profile()).toEqual(DEFAULT_PROFILE);
    expect(service.displayName()).toBe('');
    expect(service.initial()).toBe('');
    expect(service.age()).toBe(0);
    expect(service.bmi()).toBe(23.7);
    expect(translate(service.activityLevel().labelKey)).toBe('Aktiv');
    expect(service.trainingFrequency()).toBe(0);
    expect(service.intensity()).toBeNull();
    expect(service.goalDefinition()).toBeNull();
    expect(service.paceDefinition()).toBeNull();
  });

  it('derives values from updates and persists them', () => {
    const service = setup();

    service.update({
      username: 'anna',
      birthday: '1998-05-16',
      gender: 'kvinde',
      goal: 'tabe',
      pace: 'moderat',
      trainingRpe: 6,
      kcalOverride: 1900,
    });

    expect(service.displayName()).toBe('anna');
    expect(service.initial()).toBe('A');
    expect(service.age()).toBe(28);
    expect(service.intensity()?.id).toBe('moderat');
    expect(translate(service.goalDefinition()?.labelKey ?? '')).toBe('Tabe mig');
    expect(translate(service.paceDefinition()?.rateLabelKey ?? '')).toBe('0,5 kg/uge');
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PROFILE) ?? '{}')).toMatchObject({
      username: 'anna',
      goal: 'tabe',
    });
  });

  it('replaces and resets the whole profile', () => {
    const service = setup();

    service.replace({ ...DEFAULT_PROFILE, username: 'bo', weightKg: 90 });
    expect(service.profile().weightKg).toBe(90);

    service.resetToDefaults();
    expect(service.profile()).toEqual(DEFAULT_PROFILE);
  });

  it('merges a partial stored profile with the defaults', () => {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ username: 'gemt', weightKg: 82 }));

    const service = setup();

    expect(service.profile()).toEqual({ ...DEFAULT_PROFILE, username: 'gemt', weightKg: 82 });
  });
});
