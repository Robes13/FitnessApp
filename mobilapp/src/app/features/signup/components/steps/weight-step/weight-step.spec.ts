import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { WeightStep } from './weight-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('WeightStep', () => {
  let fixture: ComponentFixture<WeightStep>;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SignupStateService, provideRouter([]), ...provideComponentTestEnvironment()],
    });
    fixture = TestBed.createComponent(WeightStep);
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function number(): string {
    return root().querySelector('.weight-step__number')?.textContent?.trim() ?? '';
  }

  function stepper(label: string): HTMLButtonElement {
    const button = root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!button) {
      throw new Error(`Knappen "${label}" mangler`);
    }
    return button;
  }

  it('shows the heading, the weight, the figure and the ruler', () => {
    const text: string = root().textContent ?? '';

    expect(text).toContain('Hvad er din');
    expect(text).toContain('vægt?');
    expect(text).toContain('Din vægt i dag – du kan altid rette den senere.');
    expect(text).toContain('Træk i skalaen nedenfor, eller brug − og +.');
    expect(number()).toBe('75');
    expect(root().querySelector('app-figure')).not.toBeNull();
    expect(root().querySelector('app-ui-ruler')).not.toBeNull();
  });

  it('adjusts the weight one kilo at a time', () => {
    stepper('Et kilo mere').click();
    fixture.detectChanges();
    expect(state.weightKg()).toBe(76);
    expect(number()).toBe('76');

    stepper('Et kilo mindre').click();
    stepper('Et kilo mindre').click();
    fixture.detectChanges();
    expect(state.weightKg()).toBe(74);
  });

  it('stops at the ends of the scale', () => {
    state.weightKg.set(30);
    fixture.detectChanges();
    stepper('Et kilo mindre').click();
    expect(state.weightKg()).toBe(30);

    state.weightKg.set(300);
    fixture.detectChanges();
    stepper('Et kilo mere').click();
    expect(state.weightKg()).toBe(300);
  });

  it('writes half kilos with a Danish comma', () => {
    state.weightKg.set(74.5);
    fixture.detectChanges();

    expect(number()).toBe('74,5');
  });
});
