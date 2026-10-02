import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { SummaryStep } from './summary-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

describe('SummaryStep', () => {
  let fixture: ComponentFixture<SummaryStep>;
  let element: HTMLElement;
  let state: SignupStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...provideComponentTestEnvironment(), provideRouter([]), SignupStateService],
    });
    fixture = TestBed.createComponent(SummaryStep);
    element = fixture.nativeElement as HTMLElement;
    state = TestBed.inject(SignupStateService);
    state.username.set('mads');
    state.birthday.set('1998-05-16');
    state.gender.set('mand');
    state.goal.set('tabe');
    state.pace.set('moderat');
    fixture.detectChanges();
  });

  function rows(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll<HTMLButtonElement>('button[app-ui-row-button]'));
  }

  function caption(): string {
    return element.querySelector('.summary-step__caption')?.textContent?.trim() ?? '';
  }

  function emailInput(): HTMLInputElement {
    const input = element.querySelector<HTMLInputElement>('app-ui-text-input input');
    if (!input) {
      throw new Error('E-mailfeltet mangler');
    }
    return input;
  }

  function setEmail(value: string): void {
    const input = emailInput();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('viser overskriften og ni linjer', () => {
    expect(element.textContent).toContain('Tjek og');
    expect(element.textContent).toContain('bekræft');
    expect(rows()).toHaveLength(9);
    expect(rows()[0]?.textContent).toContain('mads');
    expect(rows()[1]?.textContent).toContain('28 år');
  });

  it('mærker hver linje som en rettelse', () => {
    expect(rows()[3]?.getAttribute('aria-label')).toBe('Ret Vægt');
  });

  it('sender brugeren tilbage til trinnet i rette-tilstand', () => {
    rows()[3]?.click();

    expect(state.step()).toBe('weight');
    expect(state.editFrom()).toBe('weight');
    expect(state.isEditing()).toBe(true);
  });

  it('beder først om e-mail, så om flueben og til sidst om det sidste tryk', () => {
    expect(caption()).toBe(
      'Skriv din e-mail – den bruger vi til at bekræfte kontoen. Tryk på en linje for at rette.',
    );

    setEmail('mads@mail.dk');
    expect(caption()).toBe(
      'Alt ser rigtigt ud? Tryk på en linje for at rette, og sæt et flueben nedenfor.',
    );

    state.termsAccepted.set(true);
    fixture.detectChanges();
    expect(caption()).toBe('Sådan. Nu mangler kun det sidste tryk.');
  });

  it('skriver e-mailen i kladden og markerer kun en forkert adresse', () => {
    expect(element.querySelector('.ui-text-input--invalid')).toBeNull();

    setEmail('mads');
    expect(state.email()).toBe('mads');
    expect(element.querySelector('.ui-text-input--invalid')).not.toBeNull();

    setEmail('mads@mail.dk');
    expect(element.querySelector('.ui-text-input--invalid')).toBeNull();
  });

  it('slår betingelserne til og fra', () => {
    const terms = element.querySelector<HTMLButtonElement>('.summary-step__terms');

    expect(terms?.getAttribute('aria-checked')).toBe('false');
    expect(terms?.textContent).toContain(
      'Jeg accepterer Nutrifys servicevilkår og privatlivspolitik, herunder behandling af mine sundheds- og profildata.',
    );

    terms?.click();
    fixture.detectChanges();

    expect(state.termsAccepted()).toBe(true);
    expect(terms?.getAttribute('aria-checked')).toBe('true');
    expect(element.querySelector('.summary-step__terms--accepted')).not.toBeNull();
  });

  it('lader pennen banke, indtil betingelserne er accepteret', () => {
    expect(element.querySelector('.summary-step__pen--tapping')).not.toBeNull();
    expect(element.querySelectorAll('.summary-step__spark')).toHaveLength(0);

    state.termsAccepted.set(true);
    fixture.detectChanges();

    expect(element.querySelector('.summary-step__pen--tapping')).toBeNull();
    expect(element.querySelectorAll('.summary-step__spark')).toHaveLength(3);
  });

  it('viser målet med orange værdi', () => {
    const goalRow = rows()[7];

    expect(goalRow?.textContent).toContain('Tabe mig · 70 kg · moderat');
    expect(goalRow?.querySelector('.ui-row-button__value--accent')).not.toBeNull();
  });
});
