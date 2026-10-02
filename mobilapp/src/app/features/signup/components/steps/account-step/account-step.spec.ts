import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { KeyboardService } from '../../../../../core/services/keyboard/keyboard';
import { SignupStateService } from '../../../services/signup-state';
import { AccountStep } from './account-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

const RULE_HINT = 'Brugernavnet skal være 3–50 tegn: bogstaver a–z (uden æ, ø og å), tal, - og _.';

describe('AccountStep', () => {
  let fixture: ComponentFixture<AccountStep>;
  let state: SignupStateService;
  const keyboardOpen = signal(false);

  beforeEach(() => {
    localStorage.clear();
    keyboardOpen.set(false);
    const keyboard: Pick<KeyboardService, 'isOpen'> = { isOpen: keyboardOpen.asReadonly() };
    TestBed.configureTestingModule({
      providers: [
        SignupStateService,
        provideRouter([]),
        ...provideComponentTestEnvironment(),
        { provide: KeyboardService, useValue: keyboard },
      ],
    });
    fixture = TestBed.createComponent(AccountStep);
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function inputs(): HTMLInputElement[] {
    return Array.from(root().querySelectorAll('input'));
  }

  function type(index: number, value: string): void {
    const field = inputs()[index];
    if (!field) {
      throw new Error(`Feltet ${index} mangler`);
    }
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('shows the heading, the subtitle and three fields', () => {
    const text: string = root().textContent ?? '';

    expect(text).toContain('Opret din');
    expect(text).toContain('konto');
    expect(text).toContain('Vælg et brugernavn og en adgangskode.');
    expect(inputs()).toHaveLength(3);
  });

  it('writes the fields into the signup draft', () => {
    type(0, 'mads');
    type(1, 'hemmelig1234');
    type(2, 'hemmelig1234');

    expect(state.username()).toBe('mads');
    expect(state.password()).toBe('hemmelig1234');
    expect(state.passwordRepeat()).toBe('hemmelig1234');
    expect(state.canContinue()).toBe(true);
  });

  it('hints that the password is too short and that the two differ', () => {
    type(1, 'kort');
    expect(root().textContent).toContain('Mindst 10 tegn.');

    type(1, 'hemmelig1234');
    type(2, 'hemmelig5678');
    expect(root().textContent).toContain('Adgangskoderne er ikke ens.');
  });

  it('hints that the username needs at least three characters and caps both lengths', () => {
    type(0, 'ma');
    expect(root().textContent).toContain(RULE_HINT);

    type(0, 'mads');
    expect(root().textContent).not.toContain('Brugernavnet skal være');
    expect(inputs().map((input) => input.maxLength)).toEqual([50, 200, 200]);
  });

  it('hints the rule for @, whitespace and letters outside a–z and blocks "Next"', () => {
    type(1, 'hemmelig1234');
    type(2, 'hemmelig1234');
    for (const username of ['mads@nutrify.dk', 'mads jensen', ' mads', 'søren']) {
      type(0, username);
      expect(root().textContent).toContain(RULE_HINT);
      expect(state.canContinue()).toBe(false);
    }
  });

  it('keeps the hint in view above the keyboard, and the field being typed in', () => {
    const reveals: string[] = [];
    const hint = root().querySelector<HTMLElement>('app-ui-form-error');
    const field = inputs()[0];
    if (!hint || !field) {
      throw new Error('Hint-linjen eller feltet mangler');
    }
    hint.scrollIntoView = () => reveals.push('hint');
    field.scrollIntoView = () => reveals.push('field');
    field.focus();

    type(0, 'ma');
    expect(reveals).toEqual([]);

    keyboardOpen.set(true);
    fixture.detectChanges();
    expect(reveals).toEqual(['hint', 'field']);

    type(0, 'mads');
    type(0, 'ma@');
    expect(reveals).toEqual(['hint', 'field', 'hint', 'field']);
  });
});
