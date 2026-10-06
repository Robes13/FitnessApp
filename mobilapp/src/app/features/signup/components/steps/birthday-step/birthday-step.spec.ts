import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { BirthdayStep } from './birthday-step';
import { MIN_AGE } from '../../../../../core/constants/nutrition';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('BirthdayStep', () => {
  let fixture: ComponentFixture<BirthdayStep>;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SignupStateService, provideRouter([]), ...provideComponentTestEnvironment()],
    });
    fixture = TestBed.createComponent(BirthdayStep);
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return root().querySelector(selector)?.textContent?.trim() ?? '';
  }

  function dateField(): HTMLInputElement {
    const field = root().querySelector<HTMLInputElement>('input[type="date"]');
    if (!field) {
      throw new Error('Datofeltet mangler');
    }
    return field;
  }

  function typeDate(value: string): void {
    const field = dateField();
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('opens on an empty date field with nothing selected', () => {
    const content: string = root().textContent ?? '';

    expect(content).toContain('Hvornår har du');
    expect(content).toContain('fødselsdag?');
    expect(content).toContain('Din alder indgår i beregningen af dit kaloriebehov.');
    expect(dateField().value).toBe('');
    expect(text('.birthday-step__age-number')).toBe('–');
    expect(text('.birthday-step__age-hint')).toBe('Vælg din fødselsdato ovenfor.');
  });

  it('limits the field to a birthday between today and the oldest age the API accepts', () => {
    // Today is Monday, September 21, 2026.
    expect(dateField().max).toBe('2026-09-21');
    expect(dateField().min).toBe('1925-09-22');
  });

  it('writes the chosen date to the state and shows the age', () => {
    typeDate('1998-06-16');

    expect(state.birthday()).toBe('1998-06-16');
    expect(text('.birthday-step__age-number')).toBe('28');
    expect(root().querySelector('.birthday-step__age-hint')).toBeNull();
  });

  it('clears the birthday when the field is emptied', () => {
    typeDate('1998-06-16');
    typeDate('');

    expect(state.birthday()).toBeNull();
    expect(text('.birthday-step__age-number')).toBe('–');
  });

  it('warns when the chosen date makes the user too young', () => {
    typeDate('2015-06-16');

    expect(text('.birthday-step__age-hint')).toBe(
      `Du skal være mindst ${MIN_AGE} år for at bruge Nutrify.`,
    );
  });

  it('draws the cake scene', () => {
    expect(root().querySelector('app-birthday-cake')).not.toBeNull();
    expect(root().querySelectorAll('.birthday-cake__tier')).toHaveLength(1);

    typeDate('1998-06-16');

    // 28 years: two tiers and one flame per year.
    expect(root().querySelectorAll('.birthday-cake__tier')).toHaveLength(2);
    expect(root().querySelectorAll('.birthday-cake__flame')).toHaveLength(25);
  });
});
