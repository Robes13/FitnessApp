import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { VERIFICATION_POLL_MS } from '../../../../core/constants/auth';
import { SessionService } from '../../../../core/services/session/session';
import { TEST_AUTH_RESPONSE, TEST_EMAIL } from '../../../../core/testing/fixtures';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { VerifyEmailSheet } from './verify-email-sheet';

const LOGIN = '/api/v1/auth/login';
const RESEND = '/api/v1/auth/email/resend-verification';
const PASSWORD = 'hemmelig1234';
const NO_CONTENT = { status: 204, statusText: 'No Content' };
const UNVERIFIED = { title: 'Forbidden', status: 403, detail: 'Email is not verified.' };
const FORBIDDEN = { status: 403, statusText: 'Forbidden' };

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** The sheet renders in the real (jsdom) DOM, with fake timers for the polling. */
describe('VerifyEmailSheet', () => {
  let fixture: ComponentFixture<VerifyEmailSheet>;
  let http: HttpTestingController;
  let session: SessionService;

  /** A login before the e-mail is verified (403): pending, with the password in memory. */
  function setup(identifier = TEST_EMAIL, open = true): void {
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    session.login(identifier, PASSWORD).subscribe();
    http.expectOne(LOGIN).flush(UNVERIFIED, FORBIDDEN);
    fixture = TestBed.createComponent(VerifyEmailSheet);
    fixture.componentRef.setInput('open', open);
    fixture.detectChanges();
  }

  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.ui-sheet__panel');
  }

  function buttonWithText(text: string): HTMLButtonElement | undefined {
    return Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (button) => normalize(button.textContent) === text,
    );
  }

  function changeVisibility(state: DocumentVisibilityState): void {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resetComponentTestStorage();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cannot be dismissed and says a link was sent to the pending e-mail', () => {
    setup();

    expect(panel()?.querySelector('.ui-sheet__close')).toBeNull();
    expect(normalize(panel()?.querySelector('.ui-sheet__title')?.textContent)).toBe(
      'Tjek din mail',
    );
    expect(normalize(panel()?.querySelector('.verify-email-sheet__copy')?.textContent)).toBe(
      `Vi har sendt et link til ${TEST_EMAIL}. Tryk på linket i mailen – appen opdager det selv.`,
    );
    expect(panel()?.querySelector('input')).toBeNull();
    expect(buttonWithText('Til login')).toBeDefined();
    expect(buttonWithText('Send mail igen')).toBeDefined();
  });

  it('logs in every 5 s while open and stops once authenticated', async () => {
    setup();

    await advance(VERIFICATION_POLL_MS - 1);
    expect(http.match(LOGIN)).toHaveLength(0);

    await advance(1);
    const first = http.expectOne({ method: 'POST', url: LOGIN });
    expect(first.request.body).toEqual({ emailOrUsername: TEST_EMAIL, password: PASSWORD });
    first.flush(UNVERIFIED, FORBIDDEN);
    expect(session.status()).toBe('pending-verification');

    await advance(VERIFICATION_POLL_MS);
    http.expectOne(LOGIN).flush(TEST_AUTH_RESPONSE);
    expect(session.isAuthenticated()).toBe(true);

    // Nothing is pending any more – `verify()` in afterEach proves there is no further login.
    await advance(3 * VERIFICATION_POLL_MS);
  });

  it('does not poll while closed', async () => {
    setup(TEST_EMAIL, false);

    await advance(3 * VERIFICATION_POLL_MS);
    changeVisibility('visible');
    expect(http.match(LOGIN)).toHaveLength(0);

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await advance(VERIFICATION_POLL_MS);
    http.expectOne(LOGIN).flush(UNVERIFIED, FORBIDDEN);

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    await advance(3 * VERIFICATION_POLL_MS);
  });

  it('checks at once when the app becomes visible again', () => {
    setup();

    changeVisibility('hidden');
    expect(http.match(LOGIN)).toHaveLength(0);

    changeVisibility('visible');
    http.expectOne(LOGIN).flush(UNVERIFIED, FORBIDDEN);
  });

  it('shows a failed check until a check works, and keeps polling', async () => {
    setup();
    const formError = () => normalize(panel()?.querySelector('app-ui-form-error')?.textContent);

    await advance(VERIFICATION_POLL_MS);
    http.expectOne(LOGIN).error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(formError()).toBe('Ingen forbindelse. Tjek dit internet, og prøv igen.');

    await advance(VERIFICATION_POLL_MS);
    http.expectOne(LOGIN).flush(UNVERIFIED, FORBIDDEN);
    fixture.detectChanges();
    expect(formError()).toBe('');
  });

  it('never runs two checks at once (each login attempt counts towards the lockout)', async () => {
    setup();

    await advance(VERIFICATION_POLL_MS);
    const running = http.expectOne(LOGIN);
    await advance(2 * VERIFICATION_POLL_MS);
    changeVisibility('visible');
    expect(http.match(LOGIN)).toHaveLength(0);

    running.flush(UNVERIFIED, FORBIDDEN);
  });

  it('sends a new link by the username a login used, which has no address to show', () => {
    setup('mads');
    expect(normalize(panel()?.querySelector('.verify-email-sheet__email')?.textContent)).toBe(
      'din mail',
    );

    buttonWithText('Send mail igen')?.click();
    const resend = http.expectOne({ method: 'POST', url: RESEND });
    expect(resend.request.body).toEqual({ emailOrUsername: 'mads' });
    resend.flush(null, NO_CONTENT);
    fixture.detectChanges();

    expect(normalize(panel()?.querySelector('.verify-email-sheet__hint')?.textContent)).toBe(
      'Tjek din indbakke, og brug linket i den nyeste mail. Der sendes højst én ny mail i minuttet.',
    );
  });

  it('goes back to login and ends the pending session', () => {
    setup();

    buttonWithText('Til login')?.click();
    fixture.detectChanges();

    expect(session.status()).toBe('guest');
    expect(TestBed.inject(Router).navigateByUrl).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });

  it('cancels a check in flight when going back to login, so the session stays ended', async () => {
    setup();
    await advance(VERIFICATION_POLL_MS);
    const running = http.expectOne(LOGIN);

    buttonWithText('Til login')?.click();

    expect(running.cancelled).toBe(true);
    expect(session.status()).toBe('guest');
    await advance(3 * VERIFICATION_POLL_MS);
  });
});
