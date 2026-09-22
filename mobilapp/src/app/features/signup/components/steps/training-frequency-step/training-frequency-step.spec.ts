import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { TrainingFrequencyStep } from './training-frequency-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

interface Setup {
  readonly fixture: ComponentFixture<TrainingFrequencyStep>;
  readonly element: HTMLElement;
  readonly state: SignupStateService;
}

function setup(): Setup {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...provideComponentTestEnvironment(), SignupStateService],
  });
  const fixture = TestBed.createComponent(TrainingFrequencyStep);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(SignupStateService),
  };
}

function setDays(result: Setup, days: readonly boolean[]): void {
  result.state.trainingDays.set(days);
  result.fixture.detectChanges();
}

/** Strict-mode-venlig opslag: fejler højlydt, hvis elementet mangler. */
function at<T extends Element>(root: ParentNode, selector: string, index: number): T {
  const found = root.querySelectorAll<T>(selector)[index];
  if (!found) {
    throw new Error(`Manglende element: ${selector}[${index}]`);
  }
  return found;
}

describe('TrainingFrequencyStep', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('counts the selected days and labels the rhythm', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Hvor ofte');
    expect(element.textContent).toContain('træner du?');
    // Kladden starter på mandag, onsdag og fredag.
    expect(element.querySelector('.training-frequency-step__count')?.textContent?.trim()).toBe('3');
    expect(element.querySelector('.training-frequency-step__pill-label')?.textContent?.trim()).toBe(
      'God rytme',
    );
    expect(element.textContent).toContain('Tryk på de dage, du typisk træner.');
  });

  it('renders the seven weekday toggles, Monday first', () => {
    const { element } = setup();
    const days = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.training-frequency-step__day'),
    );

    expect(days.map((day) => day.textContent?.trim())).toEqual([
      'M',
      'Ti',
      'O',
      'To',
      'F',
      'L',
      'S',
    ]);
    expect(at(element, '.training-frequency-step__day', 0).getAttribute('aria-label')).toBe(
      'Mandag',
    );
    expect(at(element, '.training-frequency-step__day', 0).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(at(element, '.training-frequency-step__day', 1).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('toggles a day when it is pressed', () => {
    const result = setup();
    const tuesday = at<HTMLButtonElement>(result.element, '.training-frequency-step__day', 1);

    tuesday.click();
    result.fixture.detectChanges();

    expect(result.state.trainingDays()[1]).toBe(true);
    expect(
      result.element.querySelector('.training-frequency-step__count')?.textContent?.trim(),
    ).toBe('4');
  });

  it('stops the curl without training days and sweats from six', () => {
    const result = setup();
    const curl = (): HTMLElement | null =>
      result.element.querySelector('.training-frequency-step__curl');

    // 1,8 − 3 × 0,16 = 1,32 s
    expect(curl()?.style.animationDuration).toBe('1.32s');
    expect(curl()?.style.animationPlayState).toBe('running');

    setDays(result, [false, false, false, false, false, false, false]);

    expect(curl()?.style.animationPlayState).toBe('paused');
    expect(curl()?.style.animationDuration).toBe('1.6s');
    expect(result.element.textContent).toContain('Ingen faste træninger');

    setDays(result, [true, true, true, true, true, true, false]);

    expect(result.element.querySelectorAll('.training-frequency-step__sweat')).toHaveLength(1);
    expect(result.element.textContent).toContain('Høj frekvens');
  });
});
