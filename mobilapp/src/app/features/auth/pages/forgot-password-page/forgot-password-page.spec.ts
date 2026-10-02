import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { TEST_EMAIL } from '../../../../core/testing/fixtures';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';
import { ForgotPasswordPage } from './forgot-password-page';

const FORGOT = '/api/v1/auth/password/forgot';
const NO_CONTENT = { status: 204, statusText: 'No Content' };
const IDENTIFIER = 'E-mail eller brugernavn';

function requireElement<T extends Element>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Fandt ikke "${selector}"`);
  }
  return element;
}

function text(root: HTMLElement, selector: string): string {
  return requireElement(root, selector).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

describe('ForgotPasswordPage', () => {
  // Component specs need the right `DOCUMENT` to render, so
  beforeEach(() => {
    localStorage.clear();
  });

  // An extra forgot call would revoke the link the user has just been sent.
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup() {
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const http = TestBed.inject(HttpTestingController);

    async function type(value: string): Promise<void> {
      const field = requireElement<HTMLInputElement>(root, `input[aria-label="${IDENTIFIER}"]`);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    }

    /** Taps the page's one button (it submits the form). */
    async function tap(): Promise<void> {
      requireElement<HTMLFormElement>(root, '.forgot-password-page__step').requestSubmit();
      await fixture.whenStable();
    }

    /** Answers the one pending forgot call with 204 and returns its body. */
    async function answer(): Promise<unknown> {
      const request = http.expectOne({ method: 'POST', url: FORGOT });
      request.flush(null, NO_CONTENT);
      await fixture.whenStable();
      return request.request.body;
    }

    return { root, navigate, http, type, tap, answer, fixture };
  }

  it('starts with one field for the e-mail or username', async () => {
    const { root } = await setup();

    // The soft hyphen lets the word break at a syllable with a large system font.
    expect(text(root, '.forgot-password-page__heading')).toBe('Glemt din adgangs­kode?');
    expect(text(root, '.forgot-password-page__body')).toBe(
      'Skriv din e-mail eller dit brugernavn. Vi sender dig et link til at vælge en ny adgangskode.',
    );
    const field = requireElement<HTMLInputElement>(root, `input[aria-label="${IDENTIFIER}"]`);
    expect(field.getAttribute('autocomplete')).toBe('username');
    expect(text(root, '.forgot-password-page__actions button')).toBe('Send link');
    expect(text(root, '.forgot-password-page__footnote')).toBe('Husker du den? Log ind');
  });

  it('sends exactly one request per tap and then shows the neutral text', async () => {
    const { root, type, tap, answer } = await setup();
    await type(' mads ');

    await tap();
    // Still pending: the second tap sends nothing (`verify()` would catch a second request).
    await tap();
    await expect(answer()).resolves.toEqual({ emailOrUsername: 'mads' });

    expect(text(root, '.forgot-password-page__heading')).toBe('Tjek din mail');
    expect(text(root, '.forgot-password-page__body')).toBe(
      'Hvis kontoen findes, har vi sendt en mail med et link til at vælge en ny adgangskode. Linket virker i 1 time.',
    );
    expect(root.querySelector('input')).toBeNull();
    expect(text(root, '.forgot-password-page__actions button')).toBe('Send igen');
    expect(text(root, '.forgot-password-page__footnote a')).toBe('Log ind');
  });

  it('sends the same request again with "Send igen"', async () => {
    const { root, type, tap, answer } = await setup();
    await type(TEST_EMAIL);
    await tap();
    await answer();

    await tap();
    await expect(answer()).resolves.toEqual({ emailOrUsername: TEST_EMAIL });

    expect(text(root, '.forgot-password-page__actions button')).toBe('Sendt igen');
  });

  it('shows a network error and stays on the form', async () => {
    const { root, http, type, tap, fixture } = await setup();
    await type(TEST_EMAIL);

    await tap();
    http.expectOne(FORGOT).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(text(root, 'app-ui-form-error')).toBe(
      'Ingen forbindelse. Tjek dit internet, og prøv igen.',
    );
    expect(root.querySelector(`input[aria-label="${IDENTIFIER}"]`)).not.toBeNull();
    expect(text(root, '.forgot-password-page__actions button')).toBe('Send link');
  });

  it('sends nothing without an e-mail or username', async () => {
    const { root, type, tap } = await setup();
    await type('   ');

    await tap();

    // `verify()` in afterEach proves nothing was sent.
    expect(root.querySelector('app-ui-spinner')).toBeNull();
  });

  it('goes back to login', async () => {
    const { root, navigate } = await setup();

    requireElement<HTMLButtonElement>(root, 'button[aria-label="Tilbage"]').click();

    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });
});
