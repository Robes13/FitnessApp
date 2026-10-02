import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeDayRow } from '../../services/home-summary';
import { HomeMonthSheet } from './home-month-sheet';

const ROWS: readonly HomeDayRow[] = [
  {
    id: '2026-09-24',
    label: 'Tor. 24. sep',
    kcalText: '1.850 / 2.500 kcal',
    macroText: 'P 120 g · K 200 g · F 60 g',
  },
  { id: '2026-09-23', label: 'Ons. 23. sep', kcalText: '–', macroText: '' },
];

describe('HomeMonthSheet', () => {
  let fixture: ComponentFixture<HomeMonthSheet>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setup(open: boolean): Promise<void> {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(HomeMonthSheet);
    fixture.componentRef.setInput('open', open);
    fixture.componentRef.setInput('rows', ROWS);
    await fixture.whenStable();
  }

  it('renders nothing while closed', async () => {
    await setup(false);

    expect(host().querySelector('.ui-sheet__panel')).toBeNull();
  });

  it('lists the days with kcal and macros, and no macro line for an empty day', async () => {
    await setup(true);

    expect(host().querySelector('.ui-sheet__title')?.textContent?.trim()).toBe('Seneste 30 dage');
    const days = Array.from(host().querySelectorAll('.home-month-sheet__day'));
    expect(days.map((day) => day.querySelector('.home-month-sheet__label')?.textContent)).toEqual([
      'Tor. 24. sep',
      'Ons. 23. sep',
    ]);
    expect(days[0]?.querySelector('.home-month-sheet__kcal')?.textContent).toBe(
      '1.850 / 2.500 kcal',
    );
    expect(days[0]?.querySelector('.home-month-sheet__macros')?.textContent).toBe(
      'P 120 g · K 200 g · F 60 g',
    );
    expect(days[1]?.querySelector('.home-month-sheet__kcal')?.textContent).toBe('–');
    expect(days[1]?.querySelector('.home-month-sheet__macros')).toBeNull();
  });

  it('reports closing', async () => {
    await setup(true);
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);

    host().querySelector<HTMLButtonElement>('.ui-sheet__close')?.click();

    expect(closed).toBe(1);
  });
});
