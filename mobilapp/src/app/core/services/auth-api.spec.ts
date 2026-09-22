import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEMO_PROFILE_DEFAULTS } from '../constants/demo-data';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { AuthApi } from './auth-api';

describe('AuthApi', () => {
  let api: AuthApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    api = TestBed.inject(AuthApi);
  });

  it('logs in with any non-empty credentials', async () => {
    await expect(firstValueFrom(api.login('mads', 'x'))).resolves.toBeUndefined();
  });

  it('rejects empty credentials', async () => {
    await expect(firstValueFrom(api.login('', 'x'))).rejects.toEqual({
      message: 'Udfyld brugernavn og adgangskode.',
    });
    await expect(firstValueFrom(api.login('mads', ''))).rejects.toEqual({
      message: 'Udfyld brugernavn og adgangskode.',
    });
  });

  it('registers a profile with a username and a long enough password', async () => {
    const profile = { ...DEMO_PROFILE_DEFAULTS, username: 'mads' };

    await expect(firstValueFrom(api.register(profile, 'hemmelig1'))).resolves.toBeUndefined();
    await expect(firstValueFrom(api.register(profile, 'kort'))).rejects.toEqual({
      message: 'Mindst 8 tegn.',
    });
    await expect(firstValueFrom(api.register(DEMO_PROFILE_DEFAULTS, 'hemmelig1'))).rejects.toEqual({
      message: 'Udfyld brugernavn og adgangskode.',
    });
  });

  it('validates the reset flow inputs', async () => {
    await expect(firstValueFrom(api.requestPasswordReset('dig@mail.dk'))).resolves.toBeUndefined();
    await expect(firstValueFrom(api.requestPasswordReset('dig'))).rejects.toEqual({
      message: 'Skriv en gyldig e-mail.',
    });
    await expect(firstValueFrom(api.verifyResetCode('1234'))).resolves.toBeUndefined();
    await expect(firstValueFrom(api.verifyResetCode('12a4'))).rejects.toEqual({
      message: 'Koden er 4 cifre.',
    });
    await expect(firstValueFrom(api.resetPassword('hemmelig1'))).resolves.toBeUndefined();
    await expect(firstValueFrom(api.resetPassword('kort'))).rejects.toEqual({
      message: 'Mindst 8 tegn.',
    });
  });

  it('never confirms the e-mail', async () => {
    await expect(firstValueFrom(api.resendVerification())).resolves.toBeUndefined();
    await expect(firstValueFrom(api.checkVerification())).resolves.toBe(false);
  });
});
