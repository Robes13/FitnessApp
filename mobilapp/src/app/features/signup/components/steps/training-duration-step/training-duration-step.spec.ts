import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { TrainingDurationStep } from './training-duration-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

interface Setup {
  readonly fixture: ComponentFixture<TrainingDurationStep>;
  readonly element: HTMLElement;
  readonly state: SignupStateService;
}

function setup(): Setup {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...provideComponentTestEnvironment(), SignupStateService],
  });
  const fixture = TestBed.createComponent(TrainingDurationStep);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(SignupStateService),
  };
}

function setMinutes(result: Setup, minutes: number): void {
  result.state.trainingMinutes.set(minutes);
  result.fixture.detectChanges();
}

describe('TrainingDurationStep', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the minutes, the label and the hint', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Hvor længe');
    expect(element.textContent).toContain('ad gangen?');
    expect(element.querySelector('.training-duration-step__count')?.textContent?.trim()).toBe('45');
    expect(element.querySelector('.training-duration-step__unit')?.textContent?.trim()).toBe('min');
    expect(element.querySelector('.training-duration-step__pill-label')?.textContent?.trim()).toBe(
      'Klassisk pas',
    );
    expect(element.textContent).toContain('Træk i skalaen nedenfor.');
  });

  it('fills the stopwatch ring in proportion to the minutes', () => {
    const result = setup();
    const arc = (): SVGElement | null =>
      result.element.querySelector('.training-duration-step__dial-arc');

    expect(arc()?.getAttribute('stroke-dasharray')).toBe('364.4');
    // 364.4 × (1 − 45/180) = 273.3
    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('273.3');

    setMinutes(result, 180);

    expect(arc()?.getAttribute('stroke-dashoffset')).toBe('0');
  });

  it('speeds the hand up and changes the copy with longer sessions', () => {
    const result = setup();
    const hand = (): HTMLElement | null =>
      result.element.querySelector('.training-duration-step__hand');

    // 4.5 − 45/40 = 3.38 s
    expect(hand()?.style.animationDuration).toBe('3.38s');

    setMinutes(result, 20);
    expect(result.element.textContent).toContain('Kort og effektivt');
    expect(result.element.textContent).toContain('Kort, men det tæller. Bedre end intet.');

    setMinutes(result, 150);
    expect(result.element.textContent).toContain('Udholdenhedspas');
    // 4.5 − 150/40 = 0.75 → clamped to the minimum
    expect(hand()?.style.animationDuration).toBe('1.2s');
  });

  it('offers the ruler from 10 to 180 minutes', () => {
    const { element } = setup();
    const slider = element.querySelector('[role="slider"]');

    expect(slider?.getAttribute('aria-valuemin')).toBe('10');
    expect(slider?.getAttribute('aria-valuemax')).toBe('180');
    expect(slider?.getAttribute('aria-valuenow')).toBe('45');
    expect(slider?.getAttribute('aria-label')).toBe('Minutter pr. træning');
  });
});
