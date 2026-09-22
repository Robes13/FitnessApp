import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { ActivityStep } from './activity-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

interface Setup {
  readonly fixture: ComponentFixture<ActivityStep>;
  readonly element: HTMLElement;
  readonly state: SignupStateService;
}

function setup(): Setup {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...provideComponentTestEnvironment(), SignupStateService],
  });
  const fixture = TestBed.createComponent(ActivityStep);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(SignupStateService),
  };
}

function setSteps(setupResult: Setup, steps: number): void {
  setupResult.state.stepsPerDay.set(steps);
  setupResult.fixture.detectChanges();
}

function opacityOf(element: HTMLElement, selector: string): string {
  return element.querySelector<SVGElement>(selector)?.style.opacity ?? '';
}

describe('ActivityStep', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the step count, the activity level and both conversions', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Hvor mange');
    expect(element.textContent).toContain('skridt?');
    expect(element.querySelector('.activity-step__count')?.textContent?.trim()).toBe('6.000');
    expect(element.querySelector('.activity-step__pill-label')?.textContent?.trim()).toBe('Aktiv');
    expect(element.textContent).toContain('4,5 km');
    expect(element.textContent).toContain('203 kcal');
  });

  it('swaps in the sofa scene below 2.500 steps', () => {
    const result = setup();

    expect(opacityOf(result.element, '.activity-step__walk')).toBe('1');
    expect(opacityOf(result.element, '.activity-step__lazy')).toBe('0');

    setSteps(result, 2400);

    expect(opacityOf(result.element, '.activity-step__walk')).toBe('0');
    expect(opacityOf(result.element, '.activity-step__lazy')).toBe('1');
    expect(result.element.textContent).toContain('Sofa-liga');
  });

  it('adds dog, sweat and medal at the design thresholds', () => {
    const result = setup();

    expect(opacityOf(result.element, '.activity-step__dog')).toBe('0');
    expect(result.element.querySelectorAll('.activity-step__sweat')).toHaveLength(0);

    setSteps(result, 8000);
    expect(opacityOf(result.element, '.activity-step__dog')).toBe('1');

    setSteps(result, 12000);
    expect(result.element.querySelectorAll('.activity-step__sweat')).toHaveLength(1);

    setSteps(result, 17100);
    expect(result.element.querySelectorAll('.activity-step__sweat')).toHaveLength(2);

    setSteps(result, 25000);
    expect(opacityOf(result.element, '.activity-step__medal')).toBe('1');
  });

  it('speeds the walk up with the step count and pauses it under 400 steps', () => {
    const result = setup();
    const bob = (): HTMLElement | null => result.element.querySelector('.activity-step__bob');

    // 1,2 − (6000 / 20000) × 0,88 = 0,936 → 0,94 s (designet skriver to decimaler)
    expect(bob()?.style.animationDuration).toBe('0.94s');
    expect(bob()?.style.animationPlayState).toBe('running');

    setSteps(result, 300);

    expect(bob()?.style.animationDuration).toBe('1.2s');
    expect(bob()?.style.animationPlayState).toBe('paused');
  });

  it('throws confetti when the user passes 10.000 steps', () => {
    const result = setup();

    expect(result.element.querySelectorAll('.activity-step__confetti')).toHaveLength(0);

    setSteps(result, 10000);

    expect(result.element.querySelectorAll('.activity-step__confetti')).toHaveLength(12);
  });
});
