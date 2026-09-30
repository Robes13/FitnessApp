import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
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

describe('LoginPage', () => {
  // Component specs need the right `DOCUMENT` to render, so
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup() {
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([])],
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
    const email = requireElement<HTMLInputElement>(root, 'input[aria-label="E-mail"]');
    expect(email.type).toBe('email');
    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(email.getAttribute('inputmode')).toBe('email');
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

  it('keeps the shared button classes next to the page class', async () => {
    const { root } = await setup();
    const submit = requireElement<HTMLButtonElement>(root, '.login-page__submit');

    expect(submit.classList.contains('ui-button')).toBe(true);
    expect(submit.classList.contains('ui-button--primary')).toBe(true);
    expect(submit.classList.contains('ui-button--block')).toBe(true);
  });

  it('logs in with the e-mail and goes to Home', async () => {
    const { fixture, root, navigate } = await setup();
    typeInto(root, 'E-mail', TEST_EMAIL);
    typeInto(root, 'Adgangskode', 'hemmelig1234');
    await fixture.whenStable();

    requireElement<HTMLFormElement>(root, '.login-page__form').requestSubmit();
    await fixture.whenStable();
    expect(root.querySelector('app-ui-spinner')).not.toBeNull();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ email: TEST_EMAIL, password: 'hemmelig1234' });
    request.flush(TEST_AUTH_RESPONSE);
    await fixture.whenStable();

    expect(TestBed.inject(SessionService).isAuthenticated()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
  });

  it('explains a rejected login and stays on the page', async () => {
    const { fixture, root, navigate } = await setup();
    typeInto(root, 'E-mail', TEST_EMAIL);
    typeInto(root, 'Adgangskode', 'forkert-kode');
    await fixture.whenStable();

    requireElement<HTMLFormElement>(root, '.login-page__form').requestSubmit();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/login')
      .flush(
        { title: 'Unauthorized', status: 401, detail: 'Invalid email or password.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(requireElement(root, 'app-ui-form-error').textContent?.trim()).toBe(
      'Forkert e-mail eller adgangskode – eller også er din mail ikke bekræftet endnu.',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
    expect(root.querySelector('app-ui-spinner')).toBeNull();
  });

  it('sends nothing while a field is empty', async () => {
    const { fixture, root } = await setup();
    typeInto(root, 'E-mail', TEST_EMAIL);
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

    expect(requireElement<HTMLInputElement>(root, 'input[aria-label="E-mail"]').value).toBe(
      TEST_EMAIL,
    );
  });
});
