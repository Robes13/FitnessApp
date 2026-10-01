import { HttpTestingController } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { SignupStateService } from '../../services/signup-state';
import { SIGNUP_ROUTES } from '../../signup.routes';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/** Somewhere else to go, so the flow can be left and entered again. */
@Component({ template: '' })
class ElsewherePage {}

/*
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Browserens storage ryddes pr. test.
 */
describe('SignupPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup(): Promise<{
    harness: RouterTestingHarness;
    page: HTMLElement;
    state: SignupStateService;
  }> {
    TestBed.configureTestingModule({
      providers: [
        ...provideComponentTestEnvironment(),
        // The real `SIGNUP_ROUTES`, so the test sees the same injector tree as the app.
        provideRouter([
          { path: APP_ROUTE.SIGNUP, children: SIGNUP_ROUTES },
          { path: APP_ROUTE.LOGIN, component: ElsewherePage },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(APP_PATH.SIGNUP);
    return { harness, page: harness.routeNativeElement as HTMLElement, state: stateOf(harness) };
  }

  function stateOf(harness: RouterTestingHarness): SignupStateService {
    const route = harness.routeDebugElement;
    if (!route) {
      throw new Error('Siden blev ikke tegnet');
    }
    return route.injector.get(SignupStateService);
  }

  /** A complete draft, ready to be submitted from the summary. */
  function fillDraft(state: SignupStateService): void {
    state.username.set('mads');
    state.password.set('hemmelig1234');
    state.passwordRepeat.set('hemmelig1234');
    state.birthday.set('1998-05-16');
    state.gender.set('mand');
    state.goal.set('hold');
    state.email.set('mads@nutrify.dk');
    state.termsAccepted.set(true);
    state.jumpTo('summary');
  }

  function errorText(page: HTMLElement): string {
    return page.querySelector('.signup-page__error')?.textContent?.trim() ?? '';
  }

  /** Taps "Create account" and answers `POST auth/register` with a 409. */
  async function refuseWithConflict(
    harness: RouterTestingHarness,
    page: HTMLElement,
    detail: string,
  ): Promise<void> {
    nextButton(page).click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/register')
      .flush({ title: 'Conflict', status: 409, detail }, { status: 409, statusText: 'Conflict' });
    await harness.fixture.whenStable();
  }

  function nextButton(page: HTMLElement): HTMLButtonElement {
    const button = page.querySelector<HTMLButtonElement>(
      '.signup-page__footer button:last-of-type',
    );
    if (!button) {
      throw new Error('Videre-knappen mangler');
    }
    return button;
  }

  it('shows the progress header, the first step and the footer', async () => {
    const { page } = await setup();

    // The draft starts with no training days, so the two training detail steps are hidden.
    expect(page.textContent).toContain('Trin 1 af 12');
    expect(page.textContent).toContain('Dig');
    expect(page.querySelector('app-account-step')).not.toBeNull();
    expect(page.querySelector('[aria-label="Tilbage"]')).not.toBeNull();
    expect(nextButton(page).textContent?.trim()).toBe('Næste');
  });

  it('keeps the next button disabled until the step is answered', async () => {
    const { harness, page, state } = await setup();

    expect(nextButton(page).disabled).toBe(true);

    state.username.set('mads');
    state.password.set('hemmelig1234');
    state.passwordRepeat.set('hemmelig1234');
    harness.detectChanges();

    expect(nextButton(page).disabled).toBe(false);
  });

  it('renders the step the state points at, in editing mode', async () => {
    const { harness, page, state } = await setup();

    state.jumpTo('gender');
    harness.detectChanges();

    expect(page.querySelector('app-gender-step')).not.toBeNull();
    expect(page.textContent).toContain('Retter');
    expect(page.textContent).toContain('Tilbage til opsummering');
    expect(nextButton(page).textContent?.trim()).toBe('Gem');
  });

  it('creates the account only once on a double tap and shows why the API refused it', async () => {
    const { harness, page, state } = await setup();
    fillDraft(state);
    harness.detectChanges();

    // Both taps land before the button re-renders as loading – the page itself must refuse the second.
    nextButton(page).click();
    nextButton(page).click();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/auth/register')
      .flush(
        { title: 'Conflict', status: 409, detail: 'That username is already in use.' },
        { status: 409, statusText: 'Conflict' },
      );
    await harness.fixture.whenStable();

    expect(page.querySelector('app-ui-form-error')?.textContent?.trim()).toBe(
      'Brugernavnet er taget. Vælg et andet.',
    );
    expect(nextButton(page).querySelector('app-ui-spinner')).toBeNull();
    expect(nextButton(page).disabled).toBe(false);
  });

  it('clears a taken username once the user goes to edit it', async () => {
    const { harness, page, state } = await setup();
    fillDraft(state);
    harness.detectChanges();
    await refuseWithConflict(harness, page, 'That username is already in use.');
    expect(errorText(page)).toBe('Brugernavnet er taget. Vælg et andet.');

    state.jumpTo('account');
    state.username.set('mads2');
    state.next();
    harness.detectChanges();

    expect(state.step()).toBe('summary');
    expect(errorText(page)).toBe('');
  });

  it('clears a taken e-mail once the user changes it', async () => {
    const { harness, page, state } = await setup();
    fillDraft(state);
    harness.detectChanges();
    await refuseWithConflict(harness, page, 'An account with that email already exists.');
    expect(errorText(page)).toBe('Der findes allerede en konto med den e-mail.');

    state.email.set('mads2@nutrify.dk');
    harness.detectChanges();

    expect(errorText(page)).toBe('');
  });

  it('explains an invalid e-mail on the summary, but not an empty one', async () => {
    const { harness, page, state } = await setup();
    state.jumpTo('summary');
    harness.detectChanges();
    expect(errorText(page)).toBe('');

    state.email.set('notanemail');
    harness.detectChanges();
    expect(errorText(page)).toBe('Skriv en gyldig e-mail.');

    state.email.set('mads@nutrify.dk');
    harness.detectChanges();
    expect(errorText(page)).toBe('');
  });

  it('starts an empty draft every time the flow is entered', async () => {
    const { harness, state } = await setup();
    fillDraft(state);
    harness.detectChanges();

    await harness.navigateByUrl(APP_PATH.LOGIN);
    await harness.navigateByUrl(APP_PATH.SIGNUP);
    const fresh = stateOf(harness);

    expect(fresh.step()).toBe('account');
    expect(fresh.username()).toBe('');
    expect(fresh.password()).toBe('');
    expect(fresh.passwordRepeat()).toBe('');
    expect(fresh.email()).toBe('');
    expect(fresh.gender()).toBeNull();
    expect(fresh.termsAccepted()).toBe(false);
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Trin 1 af 12');
  });

  it('asks to create the account on the summary', async () => {
    const { harness, page, state } = await setup();

    state.jumpTo('summary');
    harness.detectChanges();

    expect(page.querySelector('app-summary-step')).not.toBeNull();
    expect(nextButton(page).textContent?.trim()).toBe('Opret konto');
  });
});
