import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { FORGOT_PASSWORD_DONE_DELAY_MS, ForgotPasswordPage } from './forgot-password-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

type Fixture = ComponentFixture<ForgotPasswordPage>;

/** Every backend call responds via `timer(0)`; one tick per call in the chain. */
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
  // Component specs need the right `DOCUMENT` to render, so
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

  it('shows the backend error and stays on step 1', async () => {
    const { fixture, root } = await setup();

    typeInto(root, 'E-mail', 'dig@mail.dk');
    await fixture.whenStable();
    submitStep(root);
    await settle(fixture);

    expect(text(root, 'app-ui-form-error')).toBe('Der er ingen forbindelse til en server endnu.');
    expect(text(root, '.forgot-password-page__eyebrow')).toBe('Trin 1 af 3');
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
  });

  it('leaves for login from the back button on the first step', async () => {
    const { root, navigate } = await setup();

    requireElement<HTMLButtonElement>(root, 'button[aria-label="Tilbage"]').click();

    expect(navigate).toHaveBeenCalledWith(APP_PATH.LOGIN);
  });
});
