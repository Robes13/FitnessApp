import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { STORAGE_KEY } from '../../constants/storage-key';
import { FakeStorage, createFakeDocument, createFakeStorage } from '../../testing/fake-document';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { SessionService } from './session';
import { UserProfileService } from '../user-profile/user-profile';

const NO_BACKEND = { messageKey: 'core.auth.error.noBackend' };

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

  it('cannot log in without a backend and leaves the profile untouched', async () => {
    const session = setup();
    const profile = TestBed.inject(UserProfileService);

    await expect(firstValueFrom(session.login('mads', 'hemmelig1'))).rejects.toEqual(NO_BACKEND);

    expect(session.isLoggedIn()).toBe(false);
    expect(profile.profile().username).toBe('');
    expect(storage.getItem(STORAGE_KEY.SESSION)).toBeNull();
  });

  it('completes a signup as logged in but unverified, and verifies on check', async () => {
    const session = setup();

    await firstValueFrom(session.completeSignup());

    expect(session.isLoggedIn()).toBe(true);
    expect(session.isEmailVerified()).toBe(false);

    await expect(firstValueFrom(session.checkVerification())).resolves.toBe(true);

    expect(session.isEmailVerified()).toBe(true);
    expect(JSON.parse(storage.getItem(STORAGE_KEY.SESSION) ?? 'null')).toEqual({
      isLoggedIn: true,
      isEmailVerified: true,
    });
  });

  it('can mark the e-mail verified manually', () => {
    storage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify({ isLoggedIn: true, isEmailVerified: false }),
    );
    const session = setup();

    session.markEmailVerified();

    expect(session.isEmailVerified()).toBe(true);
  });

  it('logs out without touching the profile data', () => {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ ...DEFAULT_PROFILE, username: 'mads' }));
    storage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify({ isLoggedIn: true, isEmailVerified: true }),
    );
    const session = setup();

    session.logout();

    expect(session.isLoggedIn()).toBe(false);
    expect(session.isEmailVerified()).toBe(false);
    expect(TestBed.inject(UserProfileService).profile().username).toBe('mads');
    expect(JSON.parse(storage.getItem(STORAGE_KEY.PROFILE) ?? '{}')).toMatchObject({
      username: 'mads',
    });
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

  it('deletes the account: clears every app key and reloads at login', () => {
    for (const key of Object.values(STORAGE_KEY)) {
      storage.setItem(key, JSON.stringify('x'));
    }
    storage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify({ isLoggedIn: true, isEmailVerified: true }),
    );
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ ...DEFAULT_PROFILE, username: 'mads' }));
    const replace = vi.fn<(url: string) => void>();
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment({ storage }),
        {
          provide: DOCUMENT,
          useValue: {
            ...createFakeDocument(storage),
            baseURI: 'https://localhost/',
            location: { replace },
          },
        },
      ],
    });
    const session = TestBed.inject(SessionService);
    const profile = TestBed.inject(UserProfileService);

    session.deleteAccount();

    expect(session.isLoggedIn()).toBe(false);
    expect(profile.profile().username).toBe('');
    expect(storage.data.size).toBe(0);
    expect(replace).toHaveBeenCalledWith('https://localhost/login');
  });
});
