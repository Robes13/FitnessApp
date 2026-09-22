import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeekRing } from '../../services/home-summary';
import { HomeWeekRings } from './home-week-rings';

/** To lukkede dage, én undervejs og en fremtidig dag – nok til at dække alle tre toner. */
const RINGS: readonly WeekRing[] = [
  {
    index: 0,
    label: 'man',
    dashOffset: 0,
    tone: 'positive',
    toneClass: 'home-week-rings__progress--positive',
    isToday: false,
    isFuture: false,
    isSelected: false,
  },
  {
    index: 1,
    label: 'tir',
    dashOffset: 40,
    tone: 'accent',
    toneClass: 'home-week-rings__progress--accent',
    isToday: true,
    isFuture: false,
    isSelected: true,
  },
  {
    index: 2,
    label: 'ons',
    dashOffset: 100.5,
    tone: 'none',
    toneClass: 'home-week-rings__progress--none',
    isToday: false,
    isFuture: true,
    isSelected: false,
  },
];

describe('HomeWeekRings', () => {
  let fixture: ComponentFixture<HomeWeekRings>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function progressCircles(): SVGCircleElement[] {
    return Array.from(host().querySelectorAll<SVGCircleElement>('.home-week-rings__progress'));
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(HomeWeekRings);
    fixture.componentRef.setInput('rings', RINGS);
    await fixture.whenStable();
  });

  it('tegner én dag pr. ring med dagens forkortelse', () => {
    const labels = Array.from(host().querySelectorAll('.home-week-rings__label')).map((label) =>
      label.textContent?.trim(),
    );
    expect(labels).toEqual(['man', 'tir', 'ons']);
  });

  it('beholder blokklassen og lægger tone-modifieren oveni', () => {
    const classes = progressCircles().map((circle) => circle.getAttribute('class'));
    expect(classes[0]).toContain('home-week-rings__progress');
    expect(classes[0]).toContain('home-week-rings__progress--positive');
    expect(classes[1]).toContain('home-week-rings__progress--accent');
    expect(classes[2]).toContain('home-week-rings__progress--none');
  });

  it('binder fremdriften som stroke-dashoffset', () => {
    expect(progressCircles()[1]?.getAttribute('stroke-dashoffset')).toBe('40');
  });

  it('markerer den valgte dag og dæmper dage der ikke er kommet', () => {
    const buttons = host().querySelectorAll('.home-week-rings__day');
    expect(buttons[1]?.getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0]?.getAttribute('aria-pressed')).toBe('false');

    const labels = host().querySelectorAll('.home-week-rings__label');
    expect(labels[1]?.classList.contains('home-week-rings__label--selected')).toBe(true);
    expect(labels[2]?.classList.contains('home-week-rings__label--future')).toBe(true);
  });

  it('sender ugedagens indeks videre, når en dag vælges', () => {
    const picked: number[] = [];
    fixture.componentInstance.selected.subscribe((index) => picked.push(index));

    host().querySelectorAll<HTMLButtonElement>('.home-week-rings__day')[2]?.click();

    expect(picked).toEqual([2]);
  });

  it('fejrer kun dagens ring', async () => {
    fixture.componentRef.setInput('celebrating', true);
    await fixture.whenStable();

    const rings = host().querySelectorAll('.home-week-rings__ring');
    expect(rings[1]?.classList.contains('home-week-rings__ring--celebrating')).toBe(true);
    expect(rings[0]?.classList.contains('home-week-rings__ring--celebrating')).toBe(false);
  });
});
