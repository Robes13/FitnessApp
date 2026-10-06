import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { HeightStep } from './height-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('HeightStep', () => {
  let fixture: ComponentFixture<HeightStep>;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SignupStateService, provideRouter([]), ...provideComponentTestEnvironment()],
    });
    fixture = TestBed.createComponent(HeightStep);
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(selector: string): string {
    return root().querySelector(selector)?.textContent?.trim() ?? '';
  }

  function stepper(label: string): HTMLButtonElement {
    const button = root().querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    if (!button) {
      throw new Error(`Knappen "${label}" mangler`);
    }
    return button;
  }

  it('shows the heading, the subtitle with the weight and the BMI block', () => {
    const content: string = root().textContent ?? '';

    expect(content).toContain('Hvor');
    expect(content).toContain('høj');
    expect(content).toContain('Sammen med dine 75 kg bruger vi den til dit kaloriebehov.');
    expect(content).toContain('Højde og vægt giver');
    expect(content).toContain('i BMI');
    expect(content).toContain('Bruges til dit kaloriebehov');
    expect(text('.measure-stage__number')).toBe('178');
    // 75 kg ved 1,78 m = 23,7.
    expect(text('.height-step__bmi-number')).toBe('23,7');
  });

  it('adjusts the height one centimetre at a time and updates the BMI', () => {
    stepper('En centimeter mere').click();
    fixture.detectChanges();

    expect(state.heightCm()).toBe(179);
    expect(text('.measure-stage__number')).toBe('179');
    expect(text('.height-step__bmi-number')).toBe('23,4');
  });

  it('stops at the ends of the scale', () => {
    state.heightCm.set(100);
    fixture.detectChanges();
    stepper('En centimeter mindre').click();
    expect(state.heightCm()).toBe(100);

    state.heightCm.set(250);
    fixture.detectChanges();
    stepper('En centimeter mere').click();
    expect(state.heightCm()).toBe(250);
  });

  it('shows the ceiling only when the figure is tall enough', () => {
    expect(root().querySelector('.figure__ceiling')).not.toBeNull();

    const ceiling = root().querySelector('.figure__ceiling') as SVGLineElement;
    expect(ceiling.style.opacity).toBe('0');

    state.heightCm.set(230);
    fixture.detectChanges();
    expect((root().querySelector('.figure__ceiling') as SVGLineElement).style.opacity).toBe('1');
  });
});
