import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { UserProfileService } from '../../../../core/services/user-profile';
import { FORGOT_PASSWORD_DONE_DELAY_MS, ForgotPasswordPage } from './forgot-password-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

type Fixture = ComponentFixture<ForgotPasswordPage>;

/** Hvert backend-kald svarer via `timer(0)`; ét tick pr. kald i kæden. */
async function settle(fixture: Fixture, ticks = 1): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    await fixture.whenStable();
  }
}

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

function text(root: HTMLElement, selector: string): string {
  return requireElement(root, selector).textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

function submitButton(root: HTMLElement): HTMLButtonElement {
  return requireElement<HTMLButtonElement>(root, '.forgot-password-page__actions button');
}

function submitStep(root: HTMLElement): void {
  requireElement<HTMLFormElement>(root, '.forgot-password-page__step').requestSubmit();
}

describe('ForgotPasswordPage', () => {
  // Komponent-specs skal have det rigtige `DOCUMENT` for at kunne rendere, så
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup(doneDelayMs = 0) {
    TestBed.configureTestingModule({
      providers: [
        ...provideComponentTestEnvironment(),
        { provide: FORGOT_PASSWORD_DONE_DELAY_MS, useValue: doneDelayMs },
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(ForgotPasswordPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    return { fixture, root, navigate };
  }

  /** Kvitteringstrinnet logger ind med profilens gemte brugernavn, så det skal findes. */
  function storeUsername(username: string): void {
    TestBed.inject(UserProfileService).update({ username });
  }

  async function goToCodeStep(fixture: Fixture, root: HTMLElement): Promise<void> {
    typeInto(root, 'E-mail', 'dig@mail.dk');
    await fixture.whenStable();
    submitStep(root);
    await settle(fixture);
  }

  async function goToPasswordStep(fixture: Fixture, root: HTMLElement): Promise<void> {
    await goToCodeStep(fixture, root);
    typeInto(root, 'Firecifret kode', '1234');
    await fixture.whenStable();
    submitStep(root);
    await settle(fixture);
  }

  it('starts on step 1 with the design copy and a disabled button', async () => {
    const { root } = await setup();

    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 1 af 3');
    expect(text(root, '.forgot-password-page__heading')).toBe('Glemt din adgangskode?');
    expect(text(root, '.forgot-password-page__body')).toBe(
      'Skriv den e-mail, din konto er oprettet med. Vi sender en 4-cifret kode.',
    );
    expect(submitButton(root).textContent?.trim()).toBe('Send kode');
    expect(submitButton(root).disabled).toBe(true);
    expect(text(root, '.forgot-password-page__footnote')).toBe('Husker du den? Log ind');
  });

  it('shows the e-mail hint only after more than three characters', async () => {
    const { fixture, root } = await setup();

    typeInto(root, 'E-mail', 'dig');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('');

    typeInto(root, 'E-mail', 'dig@');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('Skriv en gyldig e-mail.');

    typeInto(root, 'E-mail', 'dig@mail.dk');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('');
    expect(submitButton(root).disabled).toBe(false);
  });

  it('moves to step 2 and shows the address the code was sent to', async () => {
    const { fixture, root } = await setup();

    await goToCodeStep(fixture, root);

    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 2 af 3');
    expect(text(root, '.forgot-password-page__heading')).toBe('Tjek din mail');
    expect(text(root, '.forgot-password-page__body')).toBe(
      'Koden er sendt til dig@mail.dk og gælder i 15 minutter.',
    );
    expect(submitButton(root).textContent?.trim()).toBe('Bekræft kode');
    expect(submitButton(root).disabled).toBe(true);
  });

  it('keeps only four digits in the code field', async () => {
    const { fixture, root } = await setup();
    await goToCodeStep(fixture, root);

    typeInto(root, 'Firecifret kode', '1a2');
    await fixture.whenStable();
    expect(
      requireElement<HTMLInputElement>(root, 'input[aria-label="Firecifret kode"]').value,
    ).toBe('12');
    expect(text(root, 'app-ui-form-error')).toBe('Koden er 4 cifre.');
    expect(submitButton(root).disabled).toBe(true);

    typeInto(root, 'Firecifret kode', '123456');
    await fixture.whenStable();
    expect(
      requireElement<HTMLInputElement>(root, 'input[aria-label="Firecifret kode"]').value,
    ).toBe('1234');
    expect(submitButton(root).disabled).toBe(false);
  });

  it('confirms a resend with the green "Sendt igen"', async () => {
    const { fixture, root } = await setup();
    await goToCodeStep(fixture, root);

    expect(root.querySelector('.forgot-password-page__resent')).toBeNull();
    requireElement<HTMLButtonElement>(root, '.forgot-password-page__link-button').click();
    await settle(fixture);

    expect(text(root, '.forgot-password-page__resent')).toBe('Sendt igen');
  });

  it('shows the password strength and blocks saving until the two match', async () => {
    const { fixture, root } = await setup();
    await goToPasswordStep(fixture, root);

    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 3 af 3');
    expect(text(root, '.forgot-password-page__heading')).toBe('Vælg en ny adgangskode');
    expect(submitButton(root).disabled).toBe(true);

    typeInto(root, 'Ny adgangskode', 'kort');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('Mindst 8 tegn.');
    expect(text(root, '.forgot-password-page__strength-label')).toBe('Svag');

    typeInto(root, 'Ny adgangskode', 'hemmelig1');
    typeInto(root, 'Gentag adgangskode', 'hemmelig2');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('Adgangskoderne er ikke ens.');
    expect(text(root, '.forgot-password-page__strength-label')).toBe('OK');
    expect(
      requireElement(root, '.forgot-password-page__strength-label').classList.contains(
        'forgot-password-page__strength-label--accent',
      ),
    ).toBe(true);
    expect(submitButton(root).disabled).toBe(true);

    typeInto(root, 'Gentag adgangskode', 'hemmelig1');
    await fixture.whenStable();
    expect(text(root, 'app-ui-form-error')).toBe('');
    expect(submitButton(root).disabled).toBe(false);
  });

  it('saves the password, shows the waiting step and logs in', async () => {
    const { fixture, root, navigate } = await setup();
    storeUsername('mads');
    await goToPasswordStep(fixture, root);

    typeInto(root, 'Ny adgangskode', 'Hemmeligkode123');
    typeInto(root, 'Gentag adgangskode', 'Hemmeligkode123');
    await fixture.whenStable();
    expect(text(root, '.forgot-password-page__strength-label')).toBe('Stærk');

    submitStep(root);
    await settle(fixture);

    expect(text(root, '.forgot-password-page__done-text')).toBe('Logger ind med ny kode…');
    expect(root.querySelector('app-ui-spinner')).not.toBeNull();

    await settle(fixture, 2);

    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(true);
    expect(TestBed.inject(UserProfileService).profile().username).toBe('mads');
    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
  });

  it('goes to login instead of logging in when the profile has no username', async () => {
    const { fixture, root, navigate } = await setup();
    await goToPasswordStep(fixture, root);

    typeInto(root, 'Ny adgangskode', 'Hemmeligkode123');
    typeInto(root, 'Gentag adgangskode', 'Hemmeligkode123');
    await fixture.whenStable();
    submitStep(root);
    await settle(fixture, 2);

    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
    expect(TestBed.inject(UserProfileService).profile().username).toBe('');
  });

  it('steps backwards and leaves for login from the first step', async () => {
    const { fixture, root, navigate } = await setup();
    await goToPasswordStep(fixture, root);
    const back = requireElement<HTMLButtonElement>(root, 'button[aria-label="Tilbage"]');

    back.click();
    await fixture.whenStable();
    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 2 af 3');

    back.click();
    await fixture.whenStable();
    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 1 af 3');
    expect(navigate).not.toHaveBeenCalled();

    back.click();
    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });

  it('cancels the pending login when the page is destroyed', async () => {
    const delayMs = 40;
    const { fixture, root, navigate } = await setup(delayMs);
    storeUsername('mads');
    await goToPasswordStep(fixture, root);

    typeInto(root, 'Ny adgangskode', 'Hemmeligkode123');
    typeInto(root, 'Gentag adgangskode', 'Hemmeligkode123');
    await fixture.whenStable();
    submitStep(root);
    await settle(fixture);

    fixture.destroy();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs * 3);
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
  });
});
