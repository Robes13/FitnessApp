import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { GoalStep } from './goal-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

/*
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`,
 * a frozen `NOW`, and 0 ms mock delays. Browser storage is cleared per test.
 */
describe('GoalStep', () => {
  let fixture: ComponentFixture<GoalStep>;
  let element: HTMLElement;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), SignupStateService],
    });
    fixture = TestBed.createComponent(GoalStep);
    element = fixture.nativeElement as HTMLElement;
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function cards(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]'));
  }

  it('viser de tre mål med designets glyffer', () => {
    expect(element.textContent).toContain('Hvad er dit');
    expect(element.textContent).toContain('mål?');
    expect(element.textContent).toContain('Hvad vil du med din vægt?');

    const labels = cards().map((card) => card.textContent ?? '');
    expect(labels[0]).toContain('Tabe mig');
    expect(labels[0]).toContain('↓');
    expect(labels[1]).toContain('Holde vægten');
    expect(labels[1]).toContain('=');
    expect(labels[2]).toContain('Tage på');
    expect(labels[2]).toContain('↑');
  });

  it('markerer det valgte kort', () => {
    state.goal.set('tage');
    fixture.detectChanges();

    expect(cards()[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(cards()[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('nulstiller tempoet og foreslår en målvægt under vægten i dag', () => {
    state.weightKg.set(80);
    state.pace.set('hurtig');

    cards()[0]?.click();

    expect(state.goal()).toBe('tabe');
    expect(state.pace()).toBeNull();
    expect(state.goalWeightKg()).toBe(75);
  });

  it('foreslår en målvægt over vægten i dag ved "tage på"', () => {
    state.weightKg.set(80);

    cards()[2]?.click();

    expect(state.goal()).toBe('tage');
    expect(state.goalWeightKg()).toBe(85);
  });

  it('foreslår vægten i dag, når vægten skal holdes', () => {
    state.weightKg.set(80.4);

    cards()[1]?.click();

    expect(state.goal()).toBe('hold');
    expect(state.goalWeightKg()).toBe(80);
  });

  it('holder forslaget over den mindste tilladte målvægt', () => {
    state.weightKg.set(36);

    cards()[0]?.click();

    expect(state.goalWeightKg()).toBe(35);
  });
});
