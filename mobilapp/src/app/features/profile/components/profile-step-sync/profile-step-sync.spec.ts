import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { HealthPlatform, HealthSource, UserConsentDto } from '../../../../core/models/step-sync';
import { HEALTH_PLATFORM } from '../../../../core/services/step-sync/health-platform';
import { StepSyncService } from '../../../../core/services/step-sync/step-sync';
import { TEST_GOAL } from '../../../../core/testing/fixtures';
import {
  TEST_NOW,
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { addDays } from '../../../../core/utils/date-format';
import { ProfileStepSync } from './profile-step-sync';

const CONSENTS = '/api/v1/me/consents';
const WITHDRAW = '/api/v1/me/consents/StepsIntegration/withdraw';
const ACTIVITY = '/api/v1/me/profile/activity';
const LABEL = 'Skridt fra Health Connect';

class FakeHealthPlatform implements HealthPlatform {
  available = true;
  access = true;
  totals: readonly number[] | Error = [6000, 8000, 7000, 9027, 5000, 8000, 9000];

  source(): HealthSource {
    return 'health-connect';
  }
  async isAvailable(): Promise<boolean> {
    return this.available;
  }
  async requestStepsAccess(): Promise<boolean> {
    return this.access;
  }
  async hasStepsAccess(): Promise<boolean> {
    return this.access;
  }
  async dailyStepTotals(): Promise<readonly number[]> {
    if (this.totals instanceof Error) {
      throw this.totals;
    }
    return this.totals;
  }
}

function stepsConsent(): UserConsentDto {
  return {
    userConsentId: 2,
    consentType: 'StepsIntegration',
    documentVersion: '1',
    grantedAt: '2026-09-01T08:00:00Z',
    withdrawnAt: null,
  };
}

describe('ProfileStepSync', () => {
  let platform: FakeHealthPlatform;
  let fixture: ComponentFixture<ProfileStepSync>;
  let host: HTMLElement;
  let http: HttpTestingController;

  beforeEach(() => {
    platform = new FakeHealthPlatform();
    resetComponentTestStorage();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  /** Lets the plugin's promises run and renders. */
  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  }

  /** Renders the row after the store's `load()`; `consents` is what `GET me/consents` answers. */
  async function setup(consents: UserConsentDto[] = []): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        ...provideComponentTestEnvironment(),
        { provide: HEALTH_PLATFORM, useValue: platform },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfileStepSync);
    host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    const loaded = firstValueFrom(TestBed.inject(StepSyncService).load());
    await settle();
    if (platform.available) {
      http
        .expectOne(`${CONSENTS}?limit=50`)
        .flush({ items: consents, nextCursor: null, hasMore: false });
    }
    await loaded;
    await settle();
  }

  function toggle(): HTMLButtonElement | null {
    return host.querySelector<HTMLButtonElement>(`[aria-label="${LABEL}"]`);
  }

  function statusText(): string | undefined {
    return host.querySelector('app-ui-form-error')?.textContent?.trim();
  }

  function buttonByText(text: string): HTMLButtonElement | undefined {
    return Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text,
    );
  }

  /** Answers the sync's PUT and the goal reload. */
  function answerSync(): void {
    const put = http.expectOne(ACTIVITY);
    put.flush({ dailySteps: put.request.body.dailySteps });
    http.expectOne('/api/v1/me/goals/current').flush(TEST_GOAL);
  }

  it('is hidden where the device has no health store (the browser)', async () => {
    platform.available = false;
    await setup();

    expect(host.textContent?.trim()).toBe('');
  });

  it('shows the latest sync when it is on', async () => {
    localStorage.setItem(
      STORAGE_KEY.STEP_SYNC,
      JSON.stringify({ syncedAt: addDays(TEST_NOW, -1).toISOString(), dailySteps: 7432 }),
    );
    await setup([stepsConsent()]);

    expect(host.querySelector('.profile-step-sync__label')?.textContent?.trim()).toBe(LABEL);
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.profile-step-sync__hint')?.textContent).toContain(
      'de seneste 30 dage',
    );
    expect(statusText()).toBe('Hentet d. 20. sep – 7.432 skridt om dagen');
  });

  it('turns on: grants the consent and syncs at once, locked meanwhile', async () => {
    await setup();
    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(statusText()).toBeUndefined();

    toggle()?.click();
    await settle();
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
    expect(toggle()?.disabled).toBe(true);
    http.expectOne({ method: 'POST', url: CONSENTS }).flush(stepsConsent());
    await settle();
    answerSync();
    await settle();

    expect(toggle()?.disabled).toBe(false);
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
    expect(statusText()).toBe('Hentet d. 21. sep – 7.432 skridt om dagen');
  });

  it('stays off and says why when access is denied', async () => {
    platform.access = false;
    await setup();

    toggle()?.click();
    await settle();

    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(statusText()).toBe('Nutrify fik ikke adgang til dine skridt, så de hentes ikke.');
  });

  it('turns off only after the confirmation, and the withdrawal', async () => {
    localStorage.setItem(
      STORAGE_KEY.STEP_SYNC,
      JSON.stringify({ syncedAt: TEST_NOW.toISOString(), dailySteps: 7432 }),
    );
    await setup([stepsConsent()]);

    toggle()?.click();
    await settle();
    expect(document.querySelector('.ui-confirm-sheet__body')?.textContent).toContain(
      'Dit aktivitetsniveau bliver stående',
    );
    buttonByText('Annuller')?.click();
    await settle();
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');

    toggle()?.click();
    await settle();
    buttonByText('Ja, slå fra')?.click();
    await settle();
    http.expectOne({ method: 'POST', url: WITHDRAW }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    await settle();

    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(statusText()).toBeUndefined();
  });

  it('stays on and says why when the withdrawal fails', async () => {
    localStorage.setItem(
      STORAGE_KEY.STEP_SYNC,
      JSON.stringify({ syncedAt: TEST_NOW.toISOString(), dailySteps: 7432 }),
    );
    await setup([stepsConsent()]);

    toggle()?.click();
    await settle();
    buttonByText('Ja, slå fra')?.click();
    await settle();
    http.expectOne(WITHDRAW).error(new ProgressEvent('error'));
    await settle();

    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
    expect(statusText()).toBe('Ingen forbindelse. Tjek dit internet, og prøv igen.');
  });

  it('2.6-3b: says the steps could not be fetched and will be tried again', async () => {
    platform.totals = new Error('Health Connect is unavailable');
    await setup([stepsConsent()]);

    expect(statusText()).toBe('Vi kunne ikke hente dine skridt. Vi prøver igen næste gang.');
  });

  it('2.6-3a: says there are too few days with steps', async () => {
    platform.totals = [6000];
    await setup([stepsConsent()]);

    expect(statusText()).toBe(
      'Ikke nok skridtdata endnu. Der skal være skridt fra mindst 7 af de seneste 30 dage.',
    );
  });

  it('2.6-4a: says where to allow access', async () => {
    platform.access = false;
    await setup([stepsConsent()]);

    expect(statusText()).toBe(
      'Nutrify har ikke adgang til dine skridt – giv adgang i Health Connect.',
    );
  });
});
