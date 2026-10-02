import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { PaceStep } from './pace-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('PaceStep', () => {
  let fixture: ComponentFixture<PaceStep>;
  let element: HTMLElement;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), SignupStateService],
    });
    fixture = TestBed.createComponent(PaceStep);
    element = fixture.nativeElement as HTMLElement;
    state = TestBed.inject(SignupStateService);
    state.goal.set('tabe');
    fixture.detectChanges();
  });

  function cards(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('button[app-ui-option-card]'));
  }

  function summary(): string {
    return element.querySelector('.pace-step__summary')?.textContent?.trim() ?? '';
  }

  it('viser de tre tempi med deres takt', () => {
    const labels = cards().map((card) => card.textContent ?? '');

    expect(labels[0]).toContain('Roligt');
    expect(labels[0]).toContain('0,25 kg/uge');
    expect(labels[1]).toContain('Moderat');
    expect(labels[1]).toContain('0,5 kg/uge');
    expect(labels[2]).toContain('Hurtigt');
    expect(labels[2]).toContain('1 kg/uge');
  });

  it('spørger efter målets retning', () => {
    expect(element.querySelector('.pace-step__intro')?.textContent?.trim()).toBe(
      'Hvor hurtigt vil du tabe dig?',
    );

    state.goal.set('tage');
    fixture.detectChanges();

    expect(element.querySelector('.pace-step__intro')?.textContent?.trim()).toBe(
      'Hvor hurtigt vil du tage på?',
    );
  });

  it('beder om et valg, før kalorietallet kan vises', () => {
    expect(summary()).toBe('Vælg et tempo for at se dagligt kalorietal.');
  });

  it('oversætter tempoet til et dagligt kalorietal', () => {
    cards()[1]?.click();
    fixture.detectChanges();

    expect(state.pace()).toBe('moderat');
    expect(summary()).toBe('Moderat · 0,5 kg/uge svarer til ca. 550 kcal mindre om dagen.');
  });

  it('skriver "ekstra" i stedet for "mindre", når man vil tage på', () => {
    state.goal.set('tage');
    cards()[2]?.click();
    fixture.detectChanges();

    expect(summary()).toBe('Hurtigt · 1 kg/uge svarer til ca. 1.100 kcal ekstra om dagen.');
  });
});
