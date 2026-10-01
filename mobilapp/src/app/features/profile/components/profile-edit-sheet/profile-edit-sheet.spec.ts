import { HttpTestingController } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { TEST_GOAL } from '../../../../core/testing/fixtures';
import { ProfileEditRowId } from '../../services/profile-edit';
import { ProfileEditSheet } from './profile-edit-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`, a
 * frozen `NOW`, and 0 ms mock delays. Saves are answered with `HttpTestingController`.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

const PROFILE_URL = '/api/v1/me/profile';
const GOALS_URL = '/api/v1/me/goals';
const CURRENT_GOAL_URL = '/api/v1/me/goals/current';
const PROFILE_DTO = {
  birthDate: '1998-05-16',
  gender: 'Male',
  height: 179,
  dailySteps: 6000,
  trainingDaysPerWeek: 0,
  workoutDurationMinutes: 45,
  trainingIntensity: 'Moderate',
  profileImageUrl: null,
};

describe('ProfileEditSheet', () => {
  let profiles: UserProfileService;
  let http: HttpTestingController;

  afterEach(() => http.verify());

  async function open(row: ProfileEditRowId | null): Promise<{
    fixture: ComponentFixture<ProfileEditSheet>;
    host: HTMLElement;
    closed: number;
  }> {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    profiles = TestBed.inject(UserProfileService);
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ProfileEditSheet);
    const state = { closed: 0 };
    fixture.componentInstance.closed.subscribe(() => state.closed++);
    fixture.componentRef.setInput('row', row);
    await fixture.whenStable();
    return {
      fixture,
      host: fixture.nativeElement as HTMLElement,
      get closed() {
        return state.closed;
      },
    };
  }

  function button(host: HTMLElement, label: string): HTMLButtonElement {
    const found = Array.from(host.querySelectorAll('button')).find(
      (element) =>
        element.getAttribute('aria-label') === label || element.textContent?.trim() === label,
    );
    if (!found) {
      throw new Error(`Ingen knap med teksten "${label}"`);
    }
    return found;
  }

  function submit(host: HTMLElement): void {
    host.querySelector('form')?.dispatchEvent(new Event('submit'));
  }

  it('renders nothing while no row is being edited', async () => {
    const { host } = await open(null);

    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows the row title and the current value', async () => {
    const { host } = await open('height');
    const field = host.querySelector<HTMLInputElement>('input[type="number"]');

    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Højde');
    expect(field?.value).toBe('178');
    expect(host.textContent).toContain('cm');
  });

  it('steps the value, saves it in the API and closes once it is saved', async () => {
    const result = await open('height');

    button(result.host, 'Mere').click();
    await result.fixture.whenStable();
    expect(result.host.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('179');

    submit(result.host);
    await result.fixture.whenStable();
    const request = http.expectOne({ method: 'PATCH', url: PROFILE_URL });
    expect(request.request.body).toEqual({ height: 179 });
    expect(button(result.host, 'Gem').getAttribute('aria-busy')).toBe('true');
    // A running save can't be closed away (no close button, Escape ignored).
    expect(result.host.querySelector('[aria-label="Luk"]')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(result.closed).toBe(0);

    request.flush(PROFILE_DTO);
    http.expectOne(CURRENT_GOAL_URL).flush(TEST_GOAL);
    await result.fixture.whenStable();

    expect(profiles.profile().heightCm).toBe(179);
    expect(result.closed).toBe(1);
  });

  it('stays open with a message when the save fails', async () => {
    const result = await open('height');

    submit(result.host);
    http
      .expectOne(PROFILE_URL)
      .flush({ title: 'Server error', status: 500 }, { status: 500, statusText: 'Server Error' });
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(result.host.textContent).toContain('Ændringen kunne ikke gemmes. Prøv igen.');
    expect(profiles.profile().heightCm).toBe(178);
  });

  it('shows the row hint', async () => {
    const { host } = await open('steps');

    expect(host.querySelector('.profile-edit-sheet__hint')?.textContent?.trim()).toBe(
      'Dit typiske daglige niveau',
    );
  });

  it('marks a number outside the row bounds and says which values are allowed', async () => {
    const { fixture, host } = await open('height');
    const field = host.querySelector<HTMLInputElement>('input[type="number"]');
    const box = host.querySelector('.profile-edit-sheet__number');
    const save = button(host, 'Gem');

    setValue(field, '50');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);
    expect(host.textContent).toContain('Vælg en værdi mellem 120 og 230 cm.');
    expect(box?.classList).toContain('profile-edit-sheet__number--invalid');

    setValue(field, '180');
    await fixture.whenStable();
    expect(save.disabled).toBe(false);
    expect(host.textContent).not.toContain('Vælg en værdi');
    expect(box?.classList).not.toContain('profile-edit-sheet__number--invalid');
  });

  it('never steps past the bounds of the row', async () => {
    const { fixture, host } = await open('trainFreq');
    const minus = button(host, 'Mindre');

    for (let click = 0; click < 6; click++) {
      minus.click();
    }
    await fixture.whenStable();

    expect(host.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('0');
  });

  it('saves an option, disables the options meanwhile and closes', async () => {
    const result = await open('goal');
    const options = result.host.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]');

    expect(options.length).toBe(3);
    at(options, 0).click();
    await result.fixture.whenStable();
    expect(Array.from(options).every((option) => option.disabled)).toBe(true);
    // A second tap while saving sends nothing.
    at(options, 1).click();

    http.expectOne({ method: 'POST', url: GOALS_URL }).flush(TEST_GOAL, {
      status: 201,
      statusText: 'Created',
    });
    await result.fixture.whenStable();

    expect(profiles.profile().goal).toBe('tabe');
    expect(result.closed).toBe(1);
  });

  it('shows why a goal weight breaks the goal and keeps Gem disabled', async () => {
    const { fixture, host } = await open('goalWeight');
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });
    await fixture.whenStable();
    const field = host.querySelector<HTMLInputElement>('input[type="number"]');
    const save = button(host, 'Gem');

    expect(save.disabled).toBe(false);

    setValue(field, '78');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);
    expect(host.textContent).toContain('Målvægten skal være under din nuværende vægt (75 kg).');

    setValue(field, '50');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);
    expect(host.textContent).toContain('Det mål er for lavt for din højde.');
  });

  it('asks for a new goal weight before switching to a goal it no longer fits', async () => {
    const result = await open('goal');
    profiles.update({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });
    await result.fixture.whenStable();

    at(result.host.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]'), 2).click();
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(profiles.profile().goal).toBe('tabe');
    expect(result.host.querySelector('h2')?.textContent?.trim()).toBe('Målvægt');
    expect(result.host.textContent).toContain('Din målvægt passer ikke til målet "Tage på"');
    expect(button(result.host, 'Gem').disabled).toBe(true);

    setValue(result.host.querySelector<HTMLInputElement>('input[type="number"]'), '80');
    await result.fixture.whenStable();
    submit(result.host);
    const request = http.expectOne({ method: 'POST', url: GOALS_URL });
    expect(request.request.body).toMatchObject({ goalType: 'GainWeight', targetWeight: 80 });
    request.flush(
      { ...TEST_GOAL, goalType: 'GainWeight', targetWeight: 80 },
      { status: 201, statusText: 'Created' },
    );
    await result.fixture.whenStable();

    expect(profiles.profile()).toMatchObject({ goal: 'tage', goalWeightKg: 80 });
    expect(result.closed).toBe(1);
  });

  it('edits the birthday in a date field and blocks an age under 13', async () => {
    const { fixture, host } = await open('birthday');
    const field = host.querySelector<HTMLInputElement>('input[type="date"]');
    const save = button(host, 'Gem');

    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Fødselsdato');
    expect(save.disabled).toBe(true);
    // The native picker gets the API's age rule (13–100 years on the frozen 21 Sep 2026).
    expect([field?.min, field?.max]).toEqual(['1925-09-22', '2013-09-21']);

    setValue(field, '2015-06-01');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);
    expect(host.textContent).toContain('Du skal være mellem 13 og 100 år.');

    setValue(field, '1990-02-03');
    await fixture.whenStable();
    expect(save.disabled).toBe(false);
    submit(host);
    const request = http.expectOne({ method: 'PATCH', url: PROFILE_URL });
    expect(request.request.body).toEqual({ birthDate: '1990-02-03' });
    request.flush({ ...PROFILE_DTO, birthDate: '1990-02-03' });
    http.expectOne(CURRENT_GOAL_URL).flush(TEST_GOAL);
    await fixture.whenStable();

    expect(profiles.profile().birthday).toBe('1990-02-03');
  });

  it('shows the age rule when the API rejects the birthday', async () => {
    const result = await open('birthday');

    setValue(result.host.querySelector<HTMLInputElement>('input[type="date"]'), '2013-09-21');
    await result.fixture.whenStable();
    submit(result.host);
    http
      .expectOne(PROFILE_URL)
      .flush(
        { status: 400, detail: 'Age must be between 13 and 100 years.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(result.host.textContent).toContain('Du skal være mellem 13 og 100 år.');
  });

  it('marks an invalid e-mail, says why and keeps Gem disabled', async () => {
    const { fixture, host } = await open('email');
    const field = host.querySelector<HTMLInputElement>('input');
    const input = host.querySelector('app-ui-text-input');
    const save = button(host, 'Gem');

    // The empty field is only disabled, not an error.
    expect(save.disabled).toBe(true);
    expect(host.textContent).not.toContain('Skriv en gyldig e-mail.');

    setValue(field, 'ui@example');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);
    expect(host.textContent).toContain('Skriv en gyldig e-mail.');
    expect(input?.classList).toContain('ui-text-input--invalid');

    setValue(field, 'mads@mail.dk');
    await fixture.whenStable();
    expect(save.disabled).toBe(false);
    expect(host.textContent).not.toContain('Skriv en gyldig e-mail.');
    expect(input?.classList).not.toContain('ui-text-input--invalid');
  });

  it('drops the API error as soon as the e-mail is changed', async () => {
    const result = await open('email');
    const field = result.host.querySelector<HTMLInputElement>('input');

    setValue(field, 'ui@@x.dk');
    await result.fixture.whenStable();
    submit(result.host);
    http
      .expectOne('/api/v1/me')
      .flush(
        { status: 400, errors: { Email: ['The Email field is not a valid e-mail address.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await result.fixture.whenStable();
    expect(result.host.textContent).toContain('Skriv en gyldig e-mail.');

    setValue(field, 'ny@mail.dk');
    await result.fixture.whenStable();
    expect(result.host.textContent).not.toContain('Skriv en gyldig e-mail.');
  });

  it('says where the confirmation link went after an e-mail change', async () => {
    const result = await open('email');

    setValue(result.host.querySelector<HTMLInputElement>('input'), ' ny@mail.dk ');
    await result.fixture.whenStable();
    submit(result.host);
    const request = http.expectOne({ method: 'PATCH', url: '/api/v1/me' });
    expect(request.request.body).toEqual({ email: 'ny@mail.dk' });
    request.flush({});
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(result.host.textContent).toContain(
      'Vi har sendt et bekræftelseslink til ny@mail.dk. Din e-mail skifter, når du trykker på linket.',
    );
    expect(profiles.profile().email).toBe('');

    button(result.host, 'Luk').click();
    expect(result.closed).toBeGreaterThan(0);
  });

  it('closes without a request when the e-mail is the current one', async () => {
    const result = await open('email');
    profiles.update({ email: 'mads@mail.dk' });
    await result.fixture.whenStable();

    setValue(result.host.querySelector<HTMLInputElement>('input'), ' MADS@mail.dk ');
    await result.fixture.whenStable();
    submit(result.host);

    expect(result.closed).toBe(1);
  });

  it('says so when the new e-mail is taken', async () => {
    const result = await open('email');

    setValue(result.host.querySelector<HTMLInputElement>('input'), 'taget@mail.dk');
    await result.fixture.whenStable();
    submit(result.host);
    http
      .expectOne('/api/v1/me')
      .flush(
        { status: 409, detail: 'An account with that email already exists.' },
        { status: 409, statusText: 'Conflict' },
      );
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(result.host.textContent).toContain('Der findes allerede en konto med den e-mail.');
  });
});

function at<T>(list: ArrayLike<T>, index: number): T {
  const item = list[index];
  if (item === undefined) {
    throw new Error(`Der er intet element nr. ${index}`);
  }
  return item;
}

function setValue(field: HTMLInputElement | null | undefined, value: string): void {
  if (!field) {
    throw new Error('Feltet findes ikke');
  }
  field.value = value;
  field.dispatchEvent(new Event('input'));
}
