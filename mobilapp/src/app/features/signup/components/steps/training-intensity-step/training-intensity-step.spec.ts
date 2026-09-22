import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SignupStateService } from '../../../services/signup-state';
import { TrainingIntensityStep } from './training-intensity-step';
import { provideComponentTestEnvironment } from '../../../../../core/testing/test-providers';

interface Setup {
  readonly fixture: ComponentFixture<TrainingIntensityStep>;
  readonly element: HTMLElement;
  readonly state: SignupStateService;
}

function setup(): Setup {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), ...provideComponentTestEnvironment(), SignupStateService],
  });
  const fixture = TestBed.createComponent(TrainingIntensityStep);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(SignupStateService),
  };
}

function setRpe(result: Setup, rpe: number | null): void {
  result.state.trainingRpe.set(rpe);
  result.fixture.detectChanges();
}

function filledSegments(element: HTMLElement): number {
  return element.querySelectorAll(
    '.training-intensity-step__segment-fill:not(.training-intensity-step__segment-fill--empty)',
  ).length;
}

/** Strict-mode-friendly lookup: fails loudly if the element is missing. */
function at<T extends Element>(root: ParentNode, selector: string, index: number): T {
  const found = root.querySelectorAll<T>(selector)[index];
  if (!found) {
    throw new Error(`Manglende element: ${selector}[${index}]`);
  }
  return found;
}

describe('TrainingIntensityStep', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('asks for a level before anything is chosen', () => {
    const { element } = setup();

    expect(element.textContent).toContain('Hvor');
    expect(element.textContent).toContain('hårdt?');
    expect(element.querySelector('.training-intensity-step__count')?.textContent?.trim()).toBe('–');
    expect(element.textContent).toContain('Hvor hårdt går du typisk til den, når du træner?');
    expect(element.textContent).toContain(
      'Sæt din anstrengelse på skalaen, eller vælg et niveau nedenfor.',
    );
    expect(element.textContent).toContain('Vælg det niveau, der passer til de fleste træninger.');
    expect(filledSegments(element)).toBe(0);
  });

  it('shows the scale and its end labels', () => {
    const { element } = setup();

    expect(element.querySelectorAll('.training-intensity-step__segment')).toHaveLength(10);
    expect(element.textContent).toContain('1 · meget let');
    expect(element.textContent).toContain('10 · alt hvad du har');
    expect(
      at<HTMLButtonElement>(element, '.training-intensity-step__segment', 3).getAttribute(
        'aria-label',
      ),
    ).toBe('Anstrengelse 4 af 10');
  });

  it('fills the scale and switches the figure when a level is set', () => {
    const result = setup();

    setRpe(result, 6);

    expect(
      result.element.querySelector('.training-intensity-step__count')?.textContent?.trim(),
    ).toBe('6');
    expect(filledSegments(result.element)).toBe(6);
    expect(result.element.textContent).toContain('Sådan føles moderat træning for de fleste.');
    expect(result.element.textContent).toContain('Du kan snakke i korte sætninger.');
    expect(result.element.querySelectorAll('.training-intensity-step__sweat')).toHaveLength(1);
    expect(result.element.querySelectorAll('.training-intensity-step__heat-line')).toHaveLength(0);
  });

  it('adds heat lines and three drops at the hard level', () => {
    const result = setup();

    setRpe(result, 9);

    expect(result.element.querySelectorAll('.training-intensity-step__heat-line')).toHaveLength(3);
    expect(result.element.querySelectorAll('.training-intensity-step__sweat')).toHaveLength(3);
    expect(result.element.textContent).toContain('Du har svært ved at få ord frem.');
  });

  it('sets the level from the three tiles', () => {
    const result = setup();
    const selector = 'button[app-ui-option-card]';
    const mild = at<HTMLButtonElement>(result.element, selector, 0);

    expect(result.element.querySelectorAll(selector)).toHaveLength(3);
    expect(mild.textContent).toContain('Mildt');
    expect(mild.textContent).toContain('3/10');

    mild.click();
    result.fixture.detectChanges();

    expect(result.state.trainingRpe()).toBe(3);
    expect(mild.getAttribute('aria-pressed')).toBe('true');
    expect(filledSegments(result.element)).toBe(3);
  });
});
