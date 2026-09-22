import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { HistoryPage } from './history-page';

/**
 * Komponenttests bruger `provideComponentTestEnvironment()`: jsdom's rigtige `DOCUMENT`,
 * fastfrosset `NOW` og 0 ms mock-forsinkelser. Storage nulstilles mellem testene, så hver
 * test starter med de seedede demo-data.
 */

function rootOf(fixture: ComponentFixture<HistoryPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function textsOf(fixture: ComponentFixture<HistoryPage>, selector: string): readonly string[] {
  return Array.from(rootOf(fixture).querySelectorAll<HTMLElement>(selector)).map((element) =>
    (element.textContent ?? '').trim(),
  );
}

describe('HistoryPage', () => {
  beforeEach(() => {
    resetComponentTestStorage();
  });

  function setup(): ComponentFixture<HistoryPage> {
    TestBed.configureTestingModule({
      providers: provideComponentTestEnvironment(),
    });
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    return fixture;
  }

  it('viser overskrift, filtre og dagsgrupper', () => {
    const fixture = setup();
    const root = rootOf(fixture);

    expect(
      root.querySelector('.history-page__title')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Din historik');
    expect(textsOf(fixture, '.history-page__filter')).toEqual(['Alle', 'Vejning', 'Mad', 'Mål']);
    expect(textsOf(fixture, '.history-page__group-label')[0]).toBe('I går · 20. sep');
    expect(root.querySelectorAll('.history-page__row').length).toBeGreaterThan(0);
    expect(root.querySelector('app-ui-empty-state')).toBeNull();
  });

  it('filtrerer listen, når en chip vælges', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    const chips = root.querySelectorAll<HTMLButtonElement>('.history-page__filter');

    chips[1]?.click();
    fixture.detectChanges();

    expect(textsOf(fixture, '.history-page__row-title')).toEqual(['Vejning', 'Vejning', 'Vejning']);
    expect(root.querySelectorAll('.history-page__relog')).toHaveLength(0);
  });

  it('viser gen-log-knappen på måltider og melder "Logget i dag" efter et tryk', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    const relog = root.querySelector<HTMLButtonElement>('.history-page__relog');

    expect(relog?.getAttribute('aria-label')).toBe('Log igen i dag');

    relog?.click();
    fixture.detectChanges();

    const updated = root.querySelector<HTMLButtonElement>('.history-page__relog');
    expect(updated?.getAttribute('aria-label')).toBe('Logget i dag');
    expect(updated?.classList.contains('history-page__relog--done')).toBe(true);

    // Sidens service rydder 2,6-sekunders-timeren, når siden lukkes.
    fixture.destroy();
  });
});
