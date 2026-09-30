import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { SignupStateService } from '../../services/signup-state';
import { SignupPage } from './signup-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

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
        provideRouter([
          { path: APP_ROUTE.SIGNUP, component: SignupPage, providers: [SignupStateService] },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(APP_PATH.SIGNUP);
    const route = harness.routeDebugElement;
    if (!route) {
      throw new Error('Siden blev ikke tegnet');
    }
    return {
      harness,
      page: harness.routeNativeElement as HTMLElement,
      state: route.injector.get(SignupStateService),
    };
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
    state.username.set('mads');
    state.password.set('hemmelig1234');
    state.passwordRepeat.set('hemmelig1234');
    state.birthday.set('1998-05-16');
    state.gender.set('mand');
    state.goal.set('hold');
    state.email.set('mads@nutrify.dk');
    state.termsAccepted.set(true);
    state.jumpTo('summary');
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

  it('asks to create the account on the summary', async () => {
    const { harness, page, state } = await setup();

    state.jumpTo('summary');
    harness.detectChanges();

    expect(page.querySelector('app-summary-step')).not.toBeNull();
    expect(nextButton(page).textContent?.trim()).toBe('Opret konto');
  });
});
