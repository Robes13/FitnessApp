import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEMO_PROFILE_DEFAULTS } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { SessionService } from './session';
import { UserProfileService } from './user-profile';

describe('SessionService', () => {
  let storage: FakeStorage;

  function setup(): SessionService {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment({ storage }) });
    return TestBed.inject(SessionService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('starts logged out', () => {
    const session = setup();

    expect(session.isLoggedIn()).toBe(false);
    expect(session.isEmailVerified()).toBe(false);
  });

  it('logs in, marks the e-mail verified and persists the session', async () => {
    const session = setup();

    await firstValueFrom(session.login('mads', 'hemmelig1'));

    expect(session.isLoggedIn()).toBe(true);
    expect(session.isEmailVerified()).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.SESSION) ?? '{}')).toEqual({
      isLoggedIn: true,
      isEmailVerified: true,
    });
  });

  it('fills an empty profile username on login but never overwrites an existing one', async () => {
    const session = setup();
    const profile = TestBed.inject(UserProfileService);

    await firstValueFrom(session.login('  mads ', 'hemmelig1'));
    expect(profile.profile().username).toBe('mads');

    await firstValueFrom(session.login('anden', 'hemmelig1'));
    expect(profile.profile().username).toBe('mads');
  });

  it('rejects empty credentials with the design copy and stays logged out', async () => {
    const session = setup();

    await expect(firstValueFrom(session.login('', 'x'))).rejects.toEqual({
      message: 'Udfyld brugernavn og adgangskode.',
    });
    expect(session.isLoggedIn()).toBe(false);
  });

  it('logs out without touching the profile data', async () => {
    storage.setItem(
      STORAGE_KEY.PROFILE,
      JSON.stringify({ ...DEMO_PROFILE_DEFAULTS, username: 'mads' }),
    );
    const session = setup();
    await firstValueFrom(session.login('mads', 'hemmelig1'));

    session.logout();

    expect(session.isLoggedIn()).toBe(false);
    expect(session.isEmailVerified()).toBe(false);
    expect(TestBed.inject(UserProfileService).profile().username).toBe('mads');
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PROFILE) ?? '{}')).toMatchObject({
      username: 'mads',
    });
  });

  it('completes signup as logged in but unverified', async () => {
    const session = setup();

    await firstValueFrom(session.completeSignup());

    expect(session.isLoggedIn()).toBe(true);
    expect(session.isEmailVerified()).toBe(false);
  });

  it('can mark the e-mail verified manually', async () => {
    const session = setup();
    await firstValueFrom(session.completeSignup());

    session.markEmailVerified();

    expect(session.isEmailVerified()).toBe(true);
  });

  it('checkVerification asks the backend, which never confirms', async () => {
    const session = setup();
    await firstValueFrom(session.completeSignup());

    await expect(firstValueFrom(session.checkVerification())).resolves.toBe(false);
    await expect(firstValueFrom(session.resendVerification())).resolves.toBeUndefined();
    expect(session.isEmailVerified()).toBe(false);
  });

  it('restores a stored session', () => {
    storage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify({ isLoggedIn: true, isEmailVerified: false }),
    );

    const session = setup();

    expect(session.isLoggedIn()).toBe(true);
    expect(session.isEmailVerified()).toBe(false);
  });
});
