import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { GenderStep } from './gender-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('GenderStep', () => {
  let fixture: ComponentFixture<GenderStep>;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [SignupStateService, provideRouter([]), ...provideComponentTestEnvironment()],
    });
    fixture = TestBed.createComponent(GenderStep);
    state = TestBed.inject(SignupStateService);
    fixture.detectChanges();
  });

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function options(): HTMLButtonElement[] {
    return Array.from(root().querySelectorAll('button[app-ui-option-card]'));
  }

  it('shows the heading and the three genders from the design', () => {
    const text: string = root().textContent ?? '';

    expect(text).toContain('Hvad er dit');
    expect(text).toContain('køn?');
    expect(text).toContain('Vi bruger det til at beregne dit kaloriebehov.');
    expect(options()).toHaveLength(3);
    expect(text).toContain('Beregnes med mandlig stofskifte-formel');
  });

  it('stores the chosen gender and marks the card', () => {
    const woman = options()[1];
    woman?.click();
    fixture.detectChanges();

    expect(state.gender()).toBe('kvinde');
    expect(woman?.getAttribute('aria-pressed')).toBe('true');

    state.jumpTo('gender');
    expect(state.canContinue()).toBe(true);
  });
});
