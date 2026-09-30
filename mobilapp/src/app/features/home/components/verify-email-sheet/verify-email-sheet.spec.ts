import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { SessionService } from '../../../../core/services/session/session';
import { PENDING_SESSION, TEST_EMAIL } from '../../../../core/testing/fixtures';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { VerifyEmailSheet } from './verify-email-sheet';

const TOKEN = 'BEEF'.repeat(16);
const NO_CONTENT = { status: 204, statusText: 'No Content' };

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** The sheet renders in the real (jsdom) DOM; the session is `pending-verification`. */
describe('VerifyEmailSheet', () => {
  let fixture: ComponentFixture<VerifyEmailSheet>;
  let http: HttpTestingController;

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.ui-sheet__panel');
  }

  function buttonWithText(text: string): HTMLButtonElement | undefined {
    return Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (button) => normalize(button.textContent) === text,
    );
  }

  function error(): string {
    return normalize(panel()?.querySelector('app-ui-form-error')?.textContent);
  }

  async function paste(value: string): Promise<void> {
    const input = panel()?.querySelector<HTMLInputElement>('input[aria-label="Kode fra mailen"]');
    if (!input) {
      throw new Error('Kodefeltet mangler');
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    resetComponentTestStorage({ [STORAGE_KEY.SESSION]: PENDING_SESSION });
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(VerifyEmailSheet);
    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
  });

  it('cannot be dismissed and asks for the code sent to the pending e-mail', () => {
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelector('.ui-sheet__close')).toBeNull();
    expect(normalize(panel()?.querySelector('.ui-sheet__title')?.textContent)).toBe(
      'Tjek din mail',
    );
    expect(normalize(panel()?.querySelector('.verify-email-sheet__copy')?.textContent)).toBe(
      `Vi har sendt en kode til ${TEST_EMAIL}. Indsæt den her for at låse appen op.`,
    );
    expect(buttonWithText('Ændre mail')).toBeUndefined();
    expect(buttonWithText('Bekræft')?.disabled).toBe(true);
  });

  it('verifies a pasted code and sends the user to login when the password is gone', async () => {
    await paste(` ${TOKEN.toLowerCase()} `);
    expect(buttonWithText('Bekræft')?.disabled).toBe(false);

    buttonWithText('Bekræft')?.click();
    const verify = http.expectOne({ method: 'POST', url: '/api/v1/auth/email/verify' });
    expect(verify.request.body).toEqual({ token: TOKEN });
    verify.flush(null, NO_CONTENT);
    await fixture.whenStable();

    expect(TestBed.inject(SessionService).status()).toBe('guest');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });

  it('shows why a code was rejected', async () => {
    await paste(TOKEN);

    buttonWithText('Bekræft')?.click();
    http.expectOne('/api/v1/auth/email/verify').flush(
      {
        title: 'Validation failed',
        status: 400,
        detail: 'The verification token is invalid or expired.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await fixture.whenStable();

    expect(error()).toBe('Koden passer ikke. Kopiér hele koden fra den nyeste mail.');
    expect(TestBed.inject(SessionService).status()).toBe('pending-verification');
  });

  it('confirms that a new code was sent', async () => {
    buttonWithText('Gensend kode')?.click();
    const resend = http.expectOne('/api/v1/auth/email/resend-verification');
    expect(resend.request.body).toEqual({ email: TEST_EMAIL });
    resend.flush(null, NO_CONTENT);
    await fixture.whenStable();

    expect(buttonWithText('Kode sendt ✓')).toBeDefined();
    expect(normalize(panel()?.querySelector('.verify-email-sheet__hint')?.textContent)).toBe(
      'Ny kode sendt – tjek også spam.',
    );
  });

  it('explains that it cannot check after a restart instead of saying "not confirmed"', async () => {
    buttonWithText('Tjek igen')?.click();
    await fixture.whenStable();

    expect(buttonWithText('Tjek igen')).toBeDefined();
    expect(buttonWithText('Ikke bekræftet')).toBeUndefined();
    expect(error()).toBe(
      'Efter en genstart kan appen ikke selv tjekke det. Indsæt koden fra mailen – eller gå til login, hvis du allerede har bekræftet.',
    );
  });

  it('goes back to login and ends the pending session', async () => {
    buttonWithText('Til login')?.click();
    await fixture.whenStable();

    expect(TestBed.inject(SessionService).status()).toBe('guest');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });
});
