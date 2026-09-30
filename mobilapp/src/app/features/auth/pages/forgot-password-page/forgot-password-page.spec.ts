import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session/session';
import { TEST_AUTH_RESPONSE, TEST_EMAIL } from '../../../../core/testing/fixtures';
import { FORGOT_PASSWORD_DONE_DELAY_MS, ForgotPasswordPage } from './forgot-password-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

type Fixture = ComponentFixture<ForgotPasswordPage>;

const TOKEN = 'C0FFEE12'.repeat(8);
const NO_CONTENT = { status: 204, statusText: 'No Content' };
const NEW_PASSWORD = 'nyhemmelig123';

/** The done step waits `FORGOT_PASSWORD_DONE_DELAY_MS` (0 ms here) – one macrotask. */
async function settle(fixture: Fixture): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  await fixture.whenStable();
}

function requireElement<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Fandt ikke "${selector}"`);
  }
  return element;
}

function typeInto(root: HTMLElement, label: string, value: string): void {
  const field = requireElement<HTMLInputElement>(root, `input[aria-label="${label}"]`);
  field.value = value;
  field.dispatchEvent(new Event('input'));
}

function text(root: HTMLElement, selector: string): string {
  return requireElement(root, selector).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function submitButton(root: HTMLElement): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(root, '.forgot-password-page__actions button');
}

function submitStep(root: HTMLElement): void {
  requireElement<HTMLFormElement>(root, '.forgot-password-page__step').requestSubmit();
}

describe('ForgotPasswordPage', () => {
  // Component specs need the right `DOCUMENT` to render, so
  beforeEach(() => {
    localStorage.clear();
  });

  // An extra forgot call would revoke the token the user has just been sent.
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup(doneDelayMs = 0) {
    TestBed.configureTestingModule({
      providers: [
        ...provideComponentTestEnvironment(),
        { provide: FORGOT_PASSWORD_DONE_DELAY_MS, useValue: doneDelayMs },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { fixture, root, navigate };
  }

  it('starts on step 1 with the design copy and a disabled button', async () => {
    const { root } = await setup();

    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 1 af 3');
    // The soft hyphen lets the word break at a syllable with a large system font.
    expect(text(root, '.forgot-password-page__heading')).toBe('Glemt din adgangs\u00adkode?');
    expect(text(root, '.forgot-password-page__body')).toBe(
      'Skriv den e-mail, din konto er oprettet med. Vi sender dig en kode.',
    );
    expect(submitButton(root).textContent?.trim()).toBe('Send kode');
    expect(submitButton(root).disabled).toBe(true);
    expect(text(root, '.forgot-password-page__footnote')).toBe('Husker du den? Log ind');
  });

  it('shows the e-mail hint only after more than three characters', async () => {
    const { fixture, root } = await setup();

    typeInto(root, 'E-mail', 'dig');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('');

    typeInto(root, 'E-mail', 'dig@');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('Skriv en gyldig e-mail.');

    typeInto(root, 'E-mail', 'dig@mail.dk');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('');
    expect(submitButton(root).disabled).toBe(false);
  });

  it('shows a network error and stays on step 1', async () => {
    const { fixture, root } = await setup();

    typeInto(root, 'E-mail', 'dig@mail.dk');
    await fixture.whenStable();
    submitStep(root);
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/password/forgot')
      .error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(text(root, 'app-ui-form-error')).toBe(
      'Ingen forbindelse. Tjek dit internet, og prøv igen.',
    );
    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 1 af 3');
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
  });

  /** Step 1 → 2: sends the e-mail and answers the forgot call. */
  async function toCodeStep(fixture: Fixture, root: HTMLElement): Promise<HttpTestingController> {
    const http = TestBed.inject(HttpTestingController);
    typeInto(root, 'E-mail', TEST_EMAIL);
    await fixture.whenStable();
    submitStep(root);
    const forgot = http.expectOne({ method: 'POST', url: '/api/v1/auth/password/forgot' });
    expect(forgot.request.body).toEqual({ email: TEST_EMAIL });
    forgot.flush(null, NO_CONTENT);
    await fixture.whenStable();
    return http;
  }

  /** Step 2 → 3 with a pasted code, then fills in the new password twice. */
  async function toPasswordStep(fixture: Fixture, root: HTMLElement): Promise<void> {
    typeInto(root, 'Kode fra mailen', ` ${TOKEN.toLowerCase()}\n`);
    await fixture.whenStable();
    submitStep(root);
    await fixture.whenStable();
    typeInto(root, 'Ny adgangskode', NEW_PASSWORD);
    typeInto(root, 'Gentag adgangskode', NEW_PASSWORD);
    await fixture.whenStable();
  }

  it('takes the pasted token, resets the password and logs in with the e-mail', async () => {
    const { fixture, root, navigate } = await setup();
    const http = await toCodeStep(fixture, root);

    expect(text(root, '.forgot-password-page__body')).toBe(
      `Koden er sendt til ${TEST_EMAIL} og gælder i 1 time. Kopiér den, og indsæt den her.`,
    );
    typeInto(root, 'Kode fra mailen', '1234');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe(
      'Koden passer ikke. Kopiér hele koden fra den nyeste mail.',
    );
    expect(submitButton(root).disabled).toBe(true);

    await toPasswordStep(fixture, root);
    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 3 af 3');
    submitStep(root);
    const reset = http.expectOne({ method: 'POST', url: '/api/v1/auth/password/reset' });
    expect(reset.request.body).toEqual({
      token: TOKEN,
      newPassword: NEW_PASSWORD,
      newPasswordConfirmation: NEW_PASSWORD,
    });
    reset.flush(null, NO_CONTENT);
    await settle(fixture);

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.body).toEqual({ email: TEST_EMAIL, password: NEW_PASSWORD });
    login.flush(TEST_AUTH_RESPONSE);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
  });

  it('says the password is changed and offers login when the login after the reset fails', async () => {
    const { fixture, root, navigate } = await setup();
    const http = await toCodeStep(fixture, root);
    await toPasswordStep(fixture, root);

    submitStep(root);
    http.expectOne('/api/v1/auth/password/reset').flush(null, NO_CONTENT);
    await settle(fixture);
    http.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(text(root, '.forgot-password-page__done-text')).toBe(
      'Din adgangskode er skiftet, men vi kunne ikke logge dig ind.',
    );
    expect(text(root, 'app-ui-form-error')).toBe(
      'Ingen forbindelse. Tjek dit internet, og prøv igen.',
    );
    expect(text(root, '.forgot-password-page__done a')).toBe('Log ind');
    expect(root.querySelector('app-ui-spinner')).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('goes back to the code step when the API rejects the token', async () => {
    const { fixture, root } = await setup();
    const http = await toCodeStep(fixture, root);
    await toPasswordStep(fixture, root);

    submitStep(root);
    http.expectOne('/api/v1/auth/password/reset').flush(
      {
        title: 'Validation failed',
        status: 400,
        detail: 'The password reset token is invalid or expired.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 2 af 3');
    expect(text(root, 'app-ui-form-error')).toBe(
      'Koden passer ikke. Kopiér hele koden fra den nyeste mail.',
    );
  });

  it('leaves for login from the back button on the first step', async () => {
    const { root, navigate } = await setup();

    requireElement<HTMLButtonElement>(root, 'button[aria-label="Tilbage"]').click();

    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });
});
