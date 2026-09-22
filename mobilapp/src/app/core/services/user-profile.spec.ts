import { TestBed } from '@angular/core/testing';
import { DEMO_PROFILE_DEFAULTS } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { UserProfileService } from './user-profile';

describe('UserProfileService', () => {
  let storage: FakeStorage;

  function setup(): UserProfileService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(UserProfileService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts from the demo defaults with the design fallback name', () => {
    const service = setup();

    expect(service.profile()).toEqual(DEMO_PROFILE_DEFAULTS);
    expect(service.displayName()).toBe('Mads');
    expect(service.initial()).toBe('M');
    expect(service.age()).toBe(0);
    expect(service.bmi()).toBe(23.7);
    expect(service.kcalTarget()).toBe(2530);
    expect(service.suggestedKcalTarget()).toBe(2530);
    expect(service.activityLevel().label).toBe('Aktiv');
    expect(service.trainingFrequency()).toBe(3);
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
    expect(service.kcalTarget()).toBe(1900);
    expect(service.suggestedKcalTarget()).toBe(1920);
    expect(service.intensity()?.id).toBe('moderat');
    expect(service.goalDefinition()?.label).toBe('Tabe mig');
    expect(service.paceDefinition()?.rateLabel).toBe('0,5 kg/uge');
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PROFILE) ?? '{}')).toMatchObject({
      username: 'anna',
      goal: 'tabe',
    });
  });

  it('replaces and resets the whole profile', () => {
    const service = setup();

    service.replace({ ...DEMO_PROFILE_DEFAULTS, username: 'bo', weightKg: 90 });
    expect(service.profile().weightKg).toBe(90);

    service.resetToDefaults();
    expect(service.profile()).toEqual(DEMO_PROFILE_DEFAULTS);
  });

  it('merges a partial stored profile with the defaults', () => {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ username: 'gemt', weightKg: 82 }));

    const service = setup();

    expect(service.profile()).toEqual({ ...DEMO_PROFILE_DEFAULTS, username: 'gemt', weightKg: 82 });
  });
});
