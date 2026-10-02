import { HttpTestingController } from '@angular/common/http/testing';
import { Component, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { HealthPlatform } from '../../../../core/models/step-sync';
import { SessionService } from '../../../../core/services/session/session';
import { HEALTH_PLATFORM } from '../../../../core/services/step-sync/health-platform';
import { StepSyncService } from '../../../../core/services/step-sync/step-sync';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../../core/services/weight-log/weight-log';
import {
  TEST_AUTH_RESPONSE,
  TEST_EMAIL,
  TEST_FOOD,
  TEST_GOAL,
  flushTestFoodLog,
  testFoodLog,
} from '../../../../core/testing/fixtures';
import { HomePage } from './home-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`, a
 * frozen `NOW`, and 0 ms mock delays. Browser storage is cleared per test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];
const WEIGHT_LOGS_URL = '/api/v1/me/weight-logs?limit=100';
/** Today's food at exactly the goal of `TEST_GOAL`. */
const GOAL_MEAL = testFoodLog({ ...TEST_FOOD, kcal: TEST_GOAL.targetDailyCalories }, 'aften');

/** Another tab: leaving Home destroys `HomePage`, as in the app's shell. */
@Component({ template: '' })
class OtherTab {}

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  async function setup(providers: Provider[] = []): Promise<{
    settle: () => Promise<void>;
    page: HTMLElement;
    harness: RouterTestingHarness;
  }> {
    TestBed.configureTestingModule({
      providers: [
        ...TEST_PROVIDERS,
        ...providers,
        provideRouter([
          { path: APP_ROUTE.HOME, component: HomePage },
          { path: APP_ROUTE.FOOD, component: OtherTab },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create(APP_PATH.HOME);
    const settle = async (): Promise<void> => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };
    await settle();
    return { settle, page: harness.routeNativeElement as HTMLElement, harness };
  }

  /** Loads the profile the way the API answers it: the five calls of `load()`, goal `TEST_GOAL`. */
  function loadProfile(): void {
    TestBed.inject(UserProfileService).load().subscribe();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/me').flush(TEST_AUTH_RESPONSE.user);
    http.expectOne('/api/v1/me/profile').flush({
      birthDate: '1998-05-16',
      gender: 'Male',
      height: 180,
      dailySteps: 6000,
      trainingDaysPerWeek: 0,
      workoutDurationMinutes: 45,
      trainingIntensity: 'Moderate',
      profileImageUrl: null,
    });
    http.expectOne('/api/v1/me/goals/recalculate').flush(TEST_GOAL);
    http.expectOne('/api/v1/me/settings').flush([]);
    http
      .expectOne('/api/v1/me/weight-logs/latest')
      .flush({ weightLogId: null, weight: 80, recordedAt: '', isStartingWeight: true });
  }

  it('2.6-3b: says when the monthly step sync failed, also without opening Profile', async () => {
    const failingHealthStore: HealthPlatform = {
      source: () => 'apple-health',
      isAvailable: async () => true,
      requestStepsAccess: async () => true,
      hasStepsAccess: async () => true,
      dailyStepTotals: async () => {
        throw new Error('HealthKit is unavailable');
      },
      openSettings: async () => undefined,
    };
    const { settle, page } = await setup([
      { provide: HEALTH_PLATFORM, useValue: failingHealthStore },
    ]);
    expect(page.querySelector('.home-page__notice')).toBeNull();

    const loaded = firstValueFrom(TestBed.inject(StepSyncService).load());
    await settle();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/v1/me/consents?limit=50')
      .flush({
        items: [
          {
            userConsentId: 2,
            consentType: 'StepsIntegration',
            documentVersion: '1',
            grantedAt: '2026-09-01T08:00:00Z',
            withdrawnAt: null,
          },
        ],
        nextCursor: null,
        hasMore: false,
      });
    await loaded;
    await settle();

    expect(page.querySelector('.home-page__notice')?.textContent?.trim()).toBe(
      'Vi kunne ikke hente dine skridt. Vi prøver igen næste gang.',
    );
  });

  it('greets the user and links the avatar to the profile', async () => {
    const { page } = await setup();
    const avatar = page.querySelector('.home-page__avatar');

    expect(page.querySelector('.home-page__greeting')?.textContent?.trim()).toBe('Hej');
    expect(page.querySelector('.home-page__today')?.textContent?.trim()).toBe('Mandag 21. sep');
    expect(avatar?.getAttribute('href')).toBe(APP_PATH.PROFILE);
    expect(avatar?.textContent?.trim()).toBe('');
  });

  it('puts the comma right after "Hej" when the name is known', async () => {
    const { settle, page } = await setup();

    TestBed.inject(UserProfileService).update({ username: 'Mads' });
    await settle();

    const greeting = page.querySelector('.home-page__greeting')?.textContent ?? '';
    expect(greeting.replace(/\s+/g, ' ').trim()).toBe('Hej, Mads');
  });

  it('renders the week rings, the next step and the day, goal and week cards', async () => {
    const { settle, page } = await setup();

    // Nothing has loaded: no guessed next step and no goal card from the sign-up defaults.
    expect(page.querySelector('app-home-todo-card')).toBeNull();
    expect(page.querySelector('app-home-goal-card')).toBeNull();

    loadProfile();
    TestBed.inject(WeightLogService).load().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(WEIGHT_LOGS_URL)
      .flush({ items: [], nextCursor: null, hasMore: false });
    await settle();

    expect(page.querySelectorAll('.home-week-rings__day')).toHaveLength(7);
    expect(page.querySelector('.home-todo-card__title')?.textContent?.trim()).toBe(
      'Husk at veje dig i dag',
    );
    expect(page.querySelector('app-home-day-card')).not.toBeNull();
    expect(page.querySelector('app-home-week-card')).not.toBeNull();
    // The API's goal is to lose weight, so the goal card shows.
    expect(page.querySelector('app-home-goal-card')).not.toBeNull();
  });

  it('locks the screen with the verify sheet until the e-mail is confirmed', async () => {
    const { settle, page } = await setup();

    expect(page.querySelector('.ui-sheet__panel')).not.toBeNull();

    const login = firstValueFrom(TestBed.inject(SessionService).login(TEST_EMAIL, 'hemmelig1234'));
    TestBed.inject(HttpTestingController).expectOne('/api/v1/auth/login').flush(TEST_AUTH_RESPONSE);
    await login;
    await settle();

    expect(page.querySelector('.ui-sheet__panel')).toBeNull();
  });

  it('does not celebrate before the target is reached', async () => {
    const { page } = await setup();

    expect(page.querySelector('app-home-celebration-toast')).toBeNull();
  });

  it('does not celebrate a goal that is already reached when the data loads', async () => {
    const { settle, page } = await setup();

    flushTestFoodLog([], [GOAL_MEAL]);
    await settle();
    loadProfile();
    await settle();

    expect(page.querySelector('app-home-celebration-toast')).toBeNull();
  });

  it('celebrates reaching the goal after the data has loaded', async () => {
    const { settle, page } = await setup();
    loadProfile();
    flushTestFoodLog();
    await settle();

    TestBed.inject(FoodLogService).addLogs([GOAL_MEAL]);
    await settle();

    expect(page.querySelector('app-home-celebration-toast')).not.toBeNull();
  });

  it('celebrates on return when the goal was reached on another tab, and only once', async () => {
    const { settle, harness } = await setup();
    loadProfile();
    flushTestFoodLog();
    await settle();

    // Food is logged on the Mad tab, so Home is gone when the goal is reached.
    await harness.navigateByUrl(APP_PATH.FOOD);
    TestBed.inject(FoodLogService).addLogs([GOAL_MEAL]);
    await settle();
    await harness.navigateByUrl(APP_PATH.HOME);
    await settle();

    expect(harness.routeNativeElement?.querySelector('app-home-celebration-toast')).not.toBeNull();

    await harness.navigateByUrl(APP_PATH.FOOD);
    await harness.navigateByUrl(APP_PATH.HOME);
    await settle();

    expect(harness.routeNativeElement?.querySelector('app-home-celebration-toast')).toBeNull();
  });

  it('takes a new baseline when the food log loads again while Home is away', async () => {
    const { settle, harness } = await setup();
    loadProfile();
    flushTestFoodLog();
    await settle();

    // E.g. signing out on Profile and in as an account that has already reached its goal.
    await harness.navigateByUrl(APP_PATH.FOOD);
    TestBed.inject(FoodLogService).reset();
    await settle();
    flushTestFoodLog([], [GOAL_MEAL]);
    await settle();
    await harness.navigateByUrl(APP_PATH.HOME);
    await settle();

    expect(harness.routeNativeElement?.querySelector('app-home-celebration-toast')).toBeNull();
  });

  it('shows a message and "Prøv igen" above the rings when a store failed to load', async () => {
    const { settle, page } = await setup();
    const http = TestBed.inject(HttpTestingController);

    expect(page.querySelector('.home-page__error')).toBeNull();

    TestBed.inject(WeightLogService).load().subscribe();
    http.expectOne(WEIGHT_LOGS_URL).flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    const error = page.querySelector('.home-page__error');
    expect(error?.nextElementSibling?.tagName).toBe('APP-HOME-WEEK-RINGS');
    expect(error?.querySelector('app-ui-form-error')?.textContent?.trim()).toBe(
      'Dine data kunne ikke hentes.',
    );

    const retry = error?.querySelector<HTMLButtonElement>('button');
    expect(retry?.textContent?.trim()).toBe('Prøv igen');
    retry?.click();
    http.expectOne(WEIGHT_LOGS_URL).flush({ items: [], nextCursor: null, hasMore: false });
    await settle();

    expect(page.querySelector('.home-page__error')).toBeNull();
  });

  it('opens and closes the last 30 days from the button under the rings', async () => {
    const { settle, page } = await setup();
    const button = page.querySelector<HTMLButtonElement>('.home-page__month');

    expect(button?.textContent?.trim()).toBe('Se de seneste 30 dage');
    expect(page.querySelector('app-home-month-sheet .ui-sheet__panel')).toBeNull();

    button?.click();
    await settle();

    expect(page.querySelectorAll('app-home-month-sheet .home-month-sheet__day')).toHaveLength(30);

    page.querySelector<HTMLButtonElement>('app-home-month-sheet .ui-sheet__close')?.click();
    await settle();

    expect(page.querySelector('app-home-month-sheet .ui-sheet__panel')).toBeNull();
  });
});
