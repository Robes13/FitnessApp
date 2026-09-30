import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { AccountStep } from './account-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('AccountStep', () => {
  let fixture: ComponentFixture<AccountStep>;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SignupStateService, provideRouter([]), ...provideComponentTestEnvironment()],
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
    expect(root().textContent).toContain('Brugernavnet skal være 3–50 tegn.');

    type(0, 'mads');
    expect(root().textContent).not.toContain('Brugernavnet skal være');
    expect(inputs().map((input) => input.maxLength)).toEqual([50, 200, 200]);
  });

  it('hints that the username cannot contain @ and blocks "Next"', () => {
    type(0, 'mads@nutrify.dk');
    type(1, 'hemmelig1234');
    type(2, 'hemmelig1234');

    expect(root().textContent).toContain('Brugernavnet må ikke indeholde @.');
    expect(state.canContinue()).toBe(false);
  });
});
