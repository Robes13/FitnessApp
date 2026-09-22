import { Provider } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionService } from '../../../../core/services/session';
import { VerifyEmailSheet } from './verify-email-sheet';
import { provideComponentTestEnvironment } from '../../../../core/testing/test-providers';

/** Arket tegnes i den rigtige (jsdom-)DOM; kun svartid og "nu" overstyres. */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('VerifyEmailSheet', () => {
  let fixture: ComponentFixture<VerifyEmailSheet>;

  function panel(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('.ui-sheet__panel');
  }

  function buttonWithText(text: string): HTMLButtonElement | undefined {
    return Array.from(panel()?.querySelectorAll('button') ?? []).find(
      (button) => normalize(button.textContent) === text,
    );
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
  }

  async function checkAgain(): Promise<void> {
    buttonWithText('Tjek igen')?.click();
    await settle();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: TEST_PROVIDERS });
    fixture = TestBed.createComponent(VerifyEmailSheet);
    fixture.componentRef.setInput('open', true);
    await settle();
  });

  it('cannot be dismissed and explains what to do', () => {
    expect(panel()).not.toBeNull();
    expect(panel()?.querySelector('.ui-sheet__close')).toBeNull();
    expect(normalize(panel()?.querySelector('.ui-sheet__title')?.textContent)).toBe(
      'Tjek din mail',
    );
    expect(normalize(panel()?.querySelector('.verify-email-sheet__copy')?.textContent)).toContain(
      'Appen låses op, når du har bekræftet.',
    );
    expect(normalize(panel()?.querySelector('.verify-email-sheet__hint')?.textContent)).toBe(
      'Ikke modtaget noget?',
    );
  });

  it('confirms that a new code has been sent', async () => {
    buttonWithText('Gensend kode')?.click();
    await settle();

    expect(buttonWithText('Kode sendt ✓')).toBeDefined();
    expect(normalize(panel()?.querySelector('.verify-email-sheet__hint')?.textContent)).toBe(
      'Ny kode sendt – tjek også spam.',
    );
  });

  it('reports that the mail is still unconfirmed', async () => {
    await checkAgain();

    expect(normalize(panel()?.querySelector('.verify-email-sheet__check')?.textContent)).toBe(
      'Ikke bekræftet',
    );
  });

  it('offers the demo shortcut after two failed checks', async () => {
    const session = TestBed.inject(SessionService);
    expect(buttonWithText('Fortsæt uden bekræftelse')).toBeUndefined();

    await checkAgain();
    expect(buttonWithText('Fortsæt uden bekræftelse')).toBeUndefined();

    // Anden gang hedder knappen "Ikke bekræftet".
    buttonWithText('Ikke bekræftet')?.click();
    await settle();

    const skip = buttonWithText('Fortsæt uden bekræftelse');
    expect(skip).toBeDefined();

    skip?.click();
    await settle();
    expect(session.isEmailVerified()).toBe(true);
  });

  it('rejects an invalid e-mail in the inline editor', async () => {
    buttonWithText('Ændre mail')?.click();
    await settle();

    const input = panel()?.querySelector('input') as HTMLInputElement;
    input.value = 'ikke-en-mail';
    input.dispatchEvent(new Event('input'));
    await settle();

    buttonWithText('Gem')?.click();
    await settle();

    expect(normalize(panel()?.querySelector('app-ui-form-error')?.textContent)).toBe(
      'Skriv en gyldig e-mail.',
    );
  });
});
