import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { BirthdayStep } from './birthday-step';
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

  function days(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('.birthday-step__day'));
  }

  function text(selector: string): string {
    return root().querySelector(selector)?.textContent?.trim() ?? '';
  }

  function yearField(): HTMLInputElement {
    const field = root().querySelector<HTMLInputElement>('.birthday-step__year');
    if (!field) {
      throw new Error('Årsfeltet mangler');
    }
    return field;
  }

  it('opens on the design default month with nothing selected', () => {
    const content: string = root().textContent ?? '';

    expect(content).toContain('Hvornår har du');
    expect(content).toContain('fødselsdag?');
    expect(content).toContain('Din alder indgår i beregningen af dit kaloriebehov.');
    expect(yearField().value).toBe('1998');
    expect(text('.birthday-step__month')).toBe('juni');
    expect(text('.birthday-step__selection')).toBe('Ingen dato valgt endnu');
    expect(text('.birthday-step__age-number')).toBe('–');
    expect(text('.birthday-step__age-hint')).toBe('Vælg din fødselsdato ovenfor.');
    expect(days()).toHaveLength(42);
  });

  it('picks a day and shows the age', () => {
    // 1. juni 1998 var en mandag, så den 16. er celle nummer 16.
    days()[15]?.click();
    fixture.detectChanges();

    expect(state.birthday()).toBe('1998-06-16');
    expect(text('.birthday-step__selection')).toBe('Valgt: 16. juni 1998');
    expect(text('.birthday-step__age-number')).toBe('28');
    expect(root().querySelector('.birthday-step__age-hint')).toBeNull();
  });

  it('warns when the chosen date makes the user too young', () => {
    state.birthday.set('2015-06-16');
    fixture.detectChanges();

    expect(text('.birthday-step__age-hint')).toBe(
      'Du skal være mindst 16 år for at bruge Nutrify.',
    );
  });

  it('moves a month back and a year forward', () => {
    root().querySelector<HTMLButtonElement>('[aria-label="Forrige måned"]')?.click();
    fixture.detectChanges();
    expect(text('.birthday-step__month')).toBe('maj');

    root().querySelector<HTMLButtonElement>('[aria-label="Et år frem"]')?.click();
    fixture.detectChanges();
    expect(yearField().value).toBe('1999');
  });

  it('accepts a typed year once it has four digits', () => {
    const field = yearField();

    field.value = '20';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(field.value).toBe('20');

    field.value = '2001';
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(field.value).toBe('2001');
    expect(text('.birthday-step__month')).toBe('juni');
  });

  it('never moves past today, and future days cannot be picked', () => {
    const field = yearField();
    field.value = '2026';
    field.dispatchEvent(new Event('input'));

    const next = root().querySelector<HTMLButtonElement>('[aria-label="Næste måned"]');
    for (let click = 0; click < 6; click++) {
      next?.click();
    }
    fixture.detectChanges();

    // I dag er mandag 21. september 2026, så oktober er utilgængelig og den 22. slået fra.
    expect(text('.birthday-step__month')).toBe('september');
    const tomorrow = days().find((day) => day.textContent?.trim() === '22');
    expect(tomorrow?.disabled).toBe(true);
  });

  it('draws the cake scene', () => {
    expect(root().querySelector('app-birthday-cake')).not.toBeNull();
    expect(root().querySelectorAll('.birthday-cake__tier')).toHaveLength(1);

    state.birthday.set('1998-06-16');
    fixture.detectChanges();

    // 28 år: to lag og ét lys pr. år.
    expect(root().querySelectorAll('.birthday-cake__tier')).toHaveLength(2);
    expect(root().querySelectorAll('.birthday-cake__flame')).toHaveLength(25);
  });
});
