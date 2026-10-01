import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { TEST_FOOD, testFood, testFoodLog, weighEntry } from '../../../../core/testing/fixtures';
import {
  TEST_NOW,
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { HistoryPage } from './history-page';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT`,
 * a frozen `NOW`. The app doesn't seed anything itself, so storage is filled here with the
 * weigh-ins, and the meal is put into the food log.
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
    resetComponentTestStorage({
      [STORAGE_KEY.WEIGHT_LOG]: [
        weighEntry('w-1', 75, 0, TEST_NOW),
        weighEntry('w-2', 75.6, 1, TEST_NOW),
        weighEntry('w-3', 76.1, 3, TEST_NOW),
      ],
    });
  });

  function setup(): ComponentFixture<HistoryPage> {
    TestBed.configureTestingModule({
      providers: provideComponentTestEnvironment(),
    });
    TestBed.inject(FoodLogService).addLogs([testFoodLog(TEST_FOOD, 'aften')]);
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
    expect(textsOf(fixture, '.history-page__group-label')[0]).toBe('I dag · 21. sep');
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

  it('viser gen-log-knappen på måltider og melder "Logget i dag", når rækken er gemt', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    const relog = root.querySelector<HTMLButtonElement>('.history-page__relog');

    expect(relog?.getAttribute('aria-label')).toBe('Log igen i dag');

    relog?.click();
    fixture.detectChanges();
    expect(relog?.getAttribute('aria-label')).toBe('Log igen i dag');
    // The meal isn't in the (empty) catalogue, so add() creates the food before it logs it.
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush(testFood({ foodId: 1, name: TEST_FOOD.name }));
    http
      .expectOne({ method: 'POST', url: '/api/v1/me/food-logs' })
      .flush(testFoodLog(TEST_FOOD, 'aften'));
    fixture.detectChanges();

    const updated = root.querySelector<HTMLButtonElement>('.history-page__relog');
    expect(updated?.getAttribute('aria-label')).toBe('Logget i dag');
    expect(updated?.classList.contains('history-page__relog--done')).toBe(true);

    // The page's service clears the 2.6-second timer when the page closes.
    fixture.destroy();
  });
});
