import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { LoginPage } from './login-page';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/** `AuthApi` svarer via `timer(0)`; ét makrotask-tick er nok til at kaldet er færdigt. */
async function settle(fixture: ComponentFixture<LoginPage>): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  await fixture.whenStable();
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

describe('LoginPage', () => {
  // Komponent-specs skal have det rigtige `DOCUMENT` for at kunne rendere, så
  beforeEach(() => {
    localStorage.clear();
  });

  async function setup() {
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(LoginPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return { fixture, root, navigate };
  }

  it('renders the design: wordmark, heading, both fields and the footer links', async () => {
    const { root } = await setup();

    expect(requireElement(root, '.login-page__wordmark').textContent).toBe('Nutrify');
    expect(
      requireElement(root, '.login-page__heading').textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Spis klogt.Træn stærkt.');
    expect(requireElement(root, '.login-page__heading-accent').textContent).toBe('Træn stærkt.');
    expect(root.querySelector('input[aria-label="Brugernavn"]')).not.toBeNull();
    expect(requireElement<HTMLInputElement>(root, 'input[aria-label="Adgangskode"]').type).toBe(
      'password',
    );
    expect(requireElement(root, '.login-page__submit').textContent?.trim()).toBe('Log ind');
    // Designet har ingen fejllinje mellem adgangskoden og knappen, før der er en fejl.
    expect(root.querySelector('app-ui-form-error')).toBeNull();

    const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a'));
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Opret konto',
      'Glemt adgangskode?',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      APP_PATH.SIGNUP,
      APP_PATH.FORGOT_PASSWORD,
    ]);
  });

  it('keeps the shared button classes next to the page class', async () => {
    const { root } = await setup();
    const submit = requireElement<HTMLButtonElement>(root, '.login-page__submit');

    expect(submit.classList.contains('ui-button')).toBe(true);
    expect(submit.classList.contains('ui-button--primary')).toBe(true);
    expect(submit.classList.contains('ui-button--block')).toBe(true);
  });

  it('logs in and goes to Hjem', async () => {
    const { fixture, root, navigate } = await setup();
    typeInto(root, 'Brugernavn', 'mads');
    typeInto(root, 'Adgangskode', 'hemmelig1');
    await fixture.whenStable();

    requireElement<HTMLFormElement>(root, '.login-page__form').requestSubmit();
    await fixture.whenStable();
    expect(root.querySelector('app-ui-spinner')).not.toBeNull();

    await settle(fixture);

    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(true);
    expect(navigate).toHaveBeenCalledWith(APP_PATH.HOME);
    expect(root.querySelector('app-ui-spinner')).toBeNull();
  });

  it('shows the backend error and stays on the page when the fields are empty', async () => {
    const { fixture, root, navigate } = await setup();

    requireElement<HTMLFormElement>(root, '.login-page__form').requestSubmit();
    await settle(fixture);

    expect(requireElement(root, 'app-ui-form-error').textContent?.trim()).toBe(
      'Udfyld brugernavn og adgangskode.',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(TestBed.inject(SessionService).isLoggedIn()).toBe(false);
  });
});
