import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { Provider, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { SessionService } from '../../../../core/services/session/session';
import { LoginPage } from './login-page';
import { TEST_AUTH_RESPONSE, TEST_EMAIL } from '../../../../core/testing/fixtures';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';

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

const IDENTIFIER = 'E-mail eller brugernavn';

describe('LoginPage', () => {
  // Component specs need the right `DOCUMENT` to render, so
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup(providers: Provider[] = []) {
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), ...providers],
    });
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return { fixture, root, navigate };
  }

  it('renders the design: wordmark, heading, both fields and the footer links', async () => {
    const { root } = await setup();

    expect(requireElement(root, '.login-page__wordmark').textContent).toBe('Nutrify');
    expect(
      requireElement(root, '.login-page__heading').textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Spis klogt.Træn stærkt.');
    expect(requireElement(root, '.login-page__heading-accent').textContent).toBe('Træn stærkt.');
    const identifier = requireElement<HTMLInputElement>(root, `input[aria-label="${IDENTIFIER}"]`);
    expect(identifier.type).toBe('text');
    expect(identifier.getAttribute('autocomplete')).toBe('username');
    expect(identifier.getAttribute('inputmode')).toBeNull();
    expect(requireElement<HTMLInputElement>(root, 'input[aria-label="Adgangskode"]').type).toBe(
      'password',
    );
    expect(requireElement(root, '.login-page__submit').textContent?.trim()).toBe('Log ind');
    // The design has no error line between the password and the button until there is an error.
    expect(root.querySelector('app-ui-form-error')).toBeNull();

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Opret konto',
      'Glemt adgangskode?',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      APP_PATH.SIGNUP,
      APP_PATH.FORGOT_PASSWORD,
    ]);
  });

  it('darkens the photo while the keyboard pushes the fields up over it', async () => {
    const keyboardOpen = signal(false);
    const keyboard: Pick<KeyboardService, 'isOpen'> = { isOpen: keyboardOpen.asReadonly() };
    const { fixture, root } = await setup([{ provide: KeyboardService, useValue: keyboard }]);
    expect(root.querySelector('.auth-backdrop__gradient')).toBeNull();

    keyboardOpen.set(true);
    await fixture.whenStable();
    expect(root.querySelector('.auth-backdrop__gradient')).not.toBeNull();

    keyboardOpen.set(false);
    await fixture.whenStable();
    expect(root.querySelector('.auth-backdrop__gradient')).toBeNull();
  });

  it('keeps the shared button classes next to the page class', async () => {
    const { root } = await setup();
    const submit = requireElement<HTMLButtonElement>(root, '.login-page__submit');

    expect(submit.classList.contains('ui-button')).toBe(true);
    expect(submit.classList.contains('ui-button--primary')).toBe(true);
    expect(submit.classList.contains('ui-button--block')).toBe(true);
  });

  /** Types the identifier and the password, submits and answers the login with `respond`. */
  async function logIn(identifier: string, respond: (request: TestRequest) => void) {
    const page = await setup();
    typeInto(page.root, IDENTIFIER, identifier);
    typeInto(page.root, 'Adgangskode', 'hemmelig1234');
    await page.fixture.whenStable();

    requireElement<HTMLFormElement>(page.root, '.login-page__form').requestSubmit();
    await page.fixture.whenStable();
    expect(page.root.querySelector('app-ui-spinner')).not.toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne({
      method: 'POST',
      url: '/api/v1/auth/login',
    });
    respond(request);
    await page.fixture.whenStable();
    return { ...page, body: request.request.body as unknown };
  }

  it.each([TEST_EMAIL, 'mads'])('logs in with %s and goes to Home', async (identifier) => {
    const { body, navigate } = await logIn(` ${identifier} `, (request) =>
      request.flush(TEST_AUTH_RESPONSE),
    );

    expect(body).toEqual({ emailOrUsername: identifier, password: 'hemmelig1234' });
    expect(TestBed.inject(SessionService).isAuthenticated()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
  });

  it('goes to Home without an error when the e-mail is not verified yet', async () => {
    const { root, navigate } = await logIn('mads', (request) =>
      request.flush(
        { title: 'Forbidden', status: 403, detail: 'Email is not verified.' },
        { status: 403, statusText: 'Forbidden' },
      ),
    );

    expect(root.querySelector('app-ui-form-error')).toBeNull();
    expect(TestBed.inject(SessionService).status()).toBe('pending-verification');
    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
  });

  it.each([
    [401, 'Invalid credentials.', 'Forkert brugernavn, e-mail eller adgangskode.'],
    [
      429,
      'Too many requests',
      'For mange mislykkede forsøg. Vent op til 15 minutter, og prøv igen.',
    ],
  ])('explains a %i and stays on the page', async (status, detail, message) => {
    const { root, navigate } = await logIn(TEST_EMAIL, (request) =>
      request.flush({ title: 'x', status, detail }, { status, statusText: 'x' }),
    );

    expect(requireElement(root, 'app-ui-form-error').textContent?.trim()).toBe(message);
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
    expect(root.querySelector('app-ui-spinner')).toBeNull();
  });

  it('sends nothing while a field is empty', async () => {
    const { fixture, root } = await setup();
    typeInto(root, IDENTIFIER, TEST_EMAIL);
    await fixture.whenStable();

    requireElement<HTMLFormElement>(root, '.login-page__form').requestSubmit();
    await fixture.whenStable();

    // `verify()` in afterEach proves no login was sent.
    expect(root.querySelector('app-ui-spinner')).toBeNull();
  });

  it('fills in the e-mail the session remembers', async () => {
    resetComponentTestStorage({
      [STORAGE_KEY.SESSION]: { status: 'guest', email: TEST_EMAIL, userId: null, tokens: null },
    });
    const { root } = await setup();

    expect(requireElement<HTMLInputElement>(root, `input[aria-label="${IDENTIFIER}"]`).value).toBe(
      TEST_EMAIL,
    );
  });
});
