import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DEFAULT_PROFILE } from '../../../../core/constants/profile-defaults';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { ProfileEditRowId } from '../../services/profile-edit';
import { ProfileEditSheet } from './profile-edit-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`, a
 * frozen `NOW`, and 0 ms mock delays. Browser storage is cleared per test.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

describe('ProfileEditSheet', () => {
  let profiles: UserProfileService;

  afterEach(() => localStorage.clear());

  async function open(row: ProfileEditRowId | null): Promise<{
    fixture: ComponentFixture<ProfileEditSheet>;
    host: HTMLElement;
    closed: number;
  }> {
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    profiles = TestBed.inject(UserProfileService);
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

  it('steps the value and saves it to the profile', async () => {
    const result = await open('height');

    button(result.host, 'Mere').click();
    await result.fixture.whenStable();
    expect(result.host.querySelector<HTMLInputElement>('input[type="number"]')?.value).toBe('179');

    result.host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await result.fixture.whenStable();

    expect(profiles.profile().heightCm).toBe(179);
    expect(result.closed).toBe(1);
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

  it('shows the calculated suggestion as a hint on the calorie row', async () => {
    const { host } = await open('kcal');

    expect(host.textContent).toContain('Beregnet forslag: 2.530 kcal');
  });

  it('applies an option immediately and closes', async () => {
    const result = await open('goal');
    const options = result.host.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]');

    expect(options.length).toBe(3);
    at(options, 0).click();
    await result.fixture.whenStable();

    expect(profiles.profile().goal).toBe('tabe');
    expect(result.closed).toBe(1);
  });

  it('shows why a goal weight breaks the goal and keeps Gem disabled', async () => {
    localStorage.setItem(
      STORAGE_KEY.PROFILE,
      JSON.stringify({ ...DEFAULT_PROFILE, goal: 'tabe', weightKg: 75, goalWeightKg: 70 }),
    );
    const { fixture, host } = await open('goalWeight');
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
    localStorage.setItem(
      STORAGE_KEY.PROFILE,
      JSON.stringify({ ...DEFAULT_PROFILE, goal: 'tabe', weightKg: 75, goalWeightKg: 70 }),
    );
    const result = await open('goal');

    at(result.host.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]'), 2).click();
    await result.fixture.whenStable();

    expect(result.closed).toBe(0);
    expect(profiles.profile().goal).toBe('tabe');
    expect(result.host.querySelector('h2')?.textContent?.trim()).toBe('Målvægt');
    expect(result.host.textContent).toContain('Din målvægt passer ikke til målet "Tage på"');
    expect(button(result.host, 'Gem').disabled).toBe(true);

    setValue(result.host.querySelector<HTMLInputElement>('input[type="number"]'), '80');
    await result.fixture.whenStable();
    result.host.querySelector('form')?.dispatchEvent(new Event('submit'));
    await result.fixture.whenStable();

    expect(profiles.profile()).toMatchObject({ goal: 'tage', goalWeightKg: 80 });
    expect(result.closed).toBe(1);
  });

  it('keeps Gem disabled for an invalid e-mail', async () => {
    const { fixture, host } = await open('email');
    const field = host.querySelector<HTMLInputElement>('input');
    const save = button(host, 'Gem');

    expect(save.disabled).toBe(true);

    setValue(field, 'ikke-en-mail');
    await fixture.whenStable();
    expect(save.disabled).toBe(true);

    setValue(field, 'mads@mail.dk');
    await fixture.whenStable();
    expect(save.disabled).toBe(false);
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
