import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_PROFILE } from '../../constants/profile-defaults';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { injectTranslate } from '../language/translate';
import { AuthApi } from './auth-api';

const NO_BACKEND = { messageKey: 'core.auth.error.noBackend' };

describe('AuthApi', () => {
  let api: AuthApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    api = TestBed.inject(AuthApi);
  });

  it('answers the sign-up calls with a stubbed success', async () => {
    await expect(
      firstValueFrom(api.register(DEFAULT_PROFILE, 'hemmelig1')),
    ).resolves.toBeUndefined();
    await expect(firstValueFrom(api.resendVerification())).resolves.toBeUndefined();
    await expect(firstValueFrom(api.checkVerification())).resolves.toBe(true);
  });

  it('fails the remaining calls until a backend exists', async () => {
    await expect(firstValueFrom(api.login('mads', 'hemmelig1'))).rejects.toEqual(NO_BACKEND);
    await expect(firstValueFrom(api.requestPasswordReset('dig@mail.dk'))).rejects.toEqual(
      NO_BACKEND,
    );
    await expect(firstValueFrom(api.verifyResetCode('1234'))).rejects.toEqual(NO_BACKEND);
    await expect(firstValueFrom(api.resetPassword('hemmelig1'))).rejects.toEqual(NO_BACKEND);
    expect(TestBed.runInInjectionContext(() => injectTranslate())(NO_BACKEND.messageKey)).toBe(
      'Der er ingen forbindelse til en server endnu.',
    );
  });
});
