import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { GoalWeightStep } from './goal-weight-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('GoalWeightStep', () => {
  let fixture: ComponentFixture<GoalWeightStep>;
  let element: HTMLElement;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), SignupStateService],
    });
    fixture = TestBed.createComponent(GoalWeightStep);
    element = fixture.nativeElement as HTMLElement;
    state = TestBed.inject(SignupStateService);
    state.goal.set('tabe');
    state.weightKg.set(75);
    state.heightCm.set(178);
    state.goalWeightKg.set(70);
    fixture.detectChanges();
  });

  function textOf(selector: string): string {
    return element.querySelector(selector)?.textContent?.trim() ?? '';
  }

  it('viser målvægten, forskellen og vægten i dag', () => {
    expect(textOf('.goal-weight-step__number')).toBe('70');
    expect(textOf('.goal-weight-step__delta-text')).toBe('−5,0 kg fra nu');
    expect(textOf('.goal-weight-step__now')).toContain('Nu: 75 kg.');
  });

  /* Skalaen stopper lige under vægten i dag, så nul forskel kan kun ske i skalaens bund. */
  it('skriver "Samme som nu", når målet er vægten i dag', () => {
    state.weightKg.set(36);
    state.goalWeightKg.set(36);
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__delta-text')).toBe('Samme som nu');
  });

  it('skriver plus, når målet er højere end vægten i dag', () => {
    state.goal.set('tage');
    state.goalWeightKg.set(80);
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__delta-text')).toBe('+5,0 kg fra nu');
  });

  it('tilpasser skalaen til målet', () => {
    const ruler = element.querySelector('app-ui-ruler [role="slider"]');
    expect(ruler?.getAttribute('aria-valuemin')).toBe('35');
    expect(ruler?.getAttribute('aria-valuemax')).toBe('74');

    state.goal.set('tage');
    fixture.detectChanges();

    const gainRuler = element.querySelector('app-ui-ruler [role="slider"]');
    expect(gainRuler?.getAttribute('aria-valuemin')).toBe('76');
    expect(gainRuler?.getAttribute('aria-valuemax')).toBe('200');
  });

  it('klemmer målvægten ind i skalaen, når målet skifter', () => {
    state.goal.set('tage');
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__number')).toBe('76');
  });

  it('advarer først, når målet er urealistisk for højden', () => {
    expect(textOf('.goal-weight-step__hint')).toBe('');

    state.goalWeightKg.set(45);
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__hint')).toBe('Det mål er for lavt for din højde.');
  });

  it('advarer den anden vej, når målet er meget højt', () => {
    state.goal.set('tage');
    state.goalWeightKg.set(160);
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__hint')).toBe('Det mål er meget højt for din højde.');
  });

  it('skriver den rette indledning pr. mål', () => {
    expect(textOf('.goal-weight-step__quip')).toBe(
      'Hvor meget vil du ned? Skalaen stopper lige under dine 75 kg.',
    );

    state.goal.set('tage');
    fixture.detectChanges();

    expect(textOf('.goal-weight-step__quip')).toBe(
      'Hvor meget vil du op? Skalaen starter lige over dine 75 kg.',
    );
  });

  it('tegner figuren ved målvægten oven på kroppen i dag', () => {
    const ghost = element.querySelector('.goal-weight-step__ghost');

    expect(ghost).not.toBeNull();
    expect(ghost?.getAttribute('stroke-dasharray')).toBe('5 5');
    expect(element.querySelector('g[app-figure-body]')).not.toBeNull();
  });
});
