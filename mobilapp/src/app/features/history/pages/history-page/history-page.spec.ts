import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CursorPage } from '../../../../core/models/api';
import { TEST_FOOD, testFood, testFoodLog, weightLogDto } from '../../../../core/testing/fixtures';
import {
  TEST_NOW,
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { HistoryEventDto } from '../../models/history';
import { HISTORY_LOAD_MORE_THRESHOLD_PX, HistoryPage } from './history-page';

/**
 * Component tests use `provideComponentTestEnvironment()`: jsdom's real `DOCUMENT` and a frozen
 * `NOW`. The history comes from `GET me/history`, answered here with `HttpTestingController`.
 */

const HISTORY_URL = '/api/v1/me/history';
const ALL_TYPES = 'AccountCreated,GoalUpdated,FoodLogged,WeightRecorded';
const NO_PAYLOAD = { foodLog: null, weightLog: null, goal: null };
/** jsdom has no layout, so the list's scroll metrics are set by hand. */
const LIST_HEIGHT_PX = 800;
const CONTENT_HEIGHT_PX = 3000;

const MEAL = testFoodLog(TEST_FOOD, 'aften');
const EVENTS: HistoryEventDto[] = [
  {
    type: 'FoodLogged',
    occurredAt: MEAL.consumedAt,
    referenceId: MEAL.foodLogId,
    ...NO_PAYLOAD,
    foodLog: MEAL,
  },
  ...[weightLogDto(1, 75, 0, TEST_NOW), weightLogDto(2, 75.6, 1, TEST_NOW)].map(
    (weightLog): HistoryEventDto => ({
      type: 'WeightRecorded',
      occurredAt: weightLog.recordedAt,
      referenceId: weightLog.weightLogId,
      ...NO_PAYLOAD,
      weightLog,
    }),
  ),
];

function page(
  items: HistoryEventDto[],
  nextCursor: string | null = null,
): CursorPage<HistoryEventDto> {
  return { items, nextCursor, hasMore: nextCursor !== null };
}

function rootOf(fixture: ComponentFixture<HistoryPage>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function textsOf(fixture: ComponentFixture<HistoryPage>, selector: string): readonly string[] {
  return Array.from(rootOf(fixture).querySelectorAll<HTMLElement>(selector)).map((element) =>
    (element.textContent ?? '').trim(),
  );
}

describe('HistoryPage', () => {
  let http: HttpTestingController;

  function expectPage(types = ALL_TYPES, cursor?: string): TestRequest {
    const query = `types=${types}&limit=50${cursor === undefined ? '' : `&cursor=${cursor}`}`;
    return http.expectOne({ method: 'GET', url: `${HISTORY_URL}?${query}` });
  }

  /** Opens the page; it asks for the first page right away. */
  function setup(): ComponentFixture<HistoryPage> {
    TestBed.configureTestingModule({ providers: provideComponentTestEnvironment() });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HistoryPage);
    fixture.detectChanges();
    return fixture;
  }

  function scrollList(fixture: ComponentFixture<HistoryPage>, scrollTop: number): void {
    const list = rootOf(fixture).querySelector<HTMLElement>('.history-page__scroll');
    if (!list) {
      throw new Error('Listen findes ikke.');
    }
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: LIST_HEIGHT_PX });
    Object.defineProperty(list, 'scrollHeight', { configurable: true, value: CONTENT_HEIGHT_PX });
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: scrollTop });
    list.dispatchEvent(new Event('scroll'));
  }

  beforeEach(() => {
    resetComponentTestStorage();
  });

  afterEach(() => http.verify());

  it('viser en spinner, mens den første side hentes, og så overskrift, filtre og dagsgrupper', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    expect(root.querySelector('app-ui-spinner')).not.toBeNull();

    expectPage().flush(page(EVENTS));
    fixture.detectChanges();

    expect(root.querySelector('app-ui-spinner')).toBeNull();
    expect(
      root.querySelector('.history-page__title')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Din historik');
    expect(textsOf(fixture, '.history-page__filter')).toEqual(['Alle', 'Vejning', 'Mad', 'Mål']);
    expect(textsOf(fixture, '.history-page__group-label')).toEqual([
      'I dag · 21. sep',
      'I går · 20. sep',
    ]);
    expect(textsOf(fixture, '.history-page__row-title')).toEqual([
      'Proteinbar',
      'Vejning',
      'Vejning',
    ]);
    expect(root.querySelector('app-ui-empty-state')).toBeNull();
  });

  it('henter næste side, når listen scrolles tæt på bunden', () => {
    const fixture = setup();
    expectPage().flush(page(EVENTS, 'c2'));
    fixture.detectChanges();

    scrollList(fixture, 0);
    http.expectNone(() => true);

    scrollList(fixture, CONTENT_HEIGHT_PX - LIST_HEIGHT_PX - HISTORY_LOAD_MORE_THRESHOLD_PX);
    expectPage(ALL_TYPES, 'c2').flush(page([]));
  });

  it('sender filteret til API’et, når en chip vælges, og viser tom tilstand uden poster', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    expectPage().flush(page(EVENTS));
    fixture.detectChanges();

    root.querySelectorAll<HTMLButtonElement>('.history-page__filter')[3]?.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.history-page__row')).toHaveLength(0);
    expectPage('GoalUpdated').flush(page([]));
    fixture.detectChanges();

    expect(root.querySelector('app-ui-empty-state')?.textContent?.trim()).toBe(
      'Ingen poster endnu.',
    );
  });

  it('viser en fejl med "Prøv igen", som henter siden igen', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    expectPage().flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    expect(root.querySelector('app-ui-form-error')?.textContent?.trim()).toBe(
      'Historikken kunne ikke hentes.',
    );
    const retry = root.querySelector<HTMLButtonElement>('.history-page__status button');
    expect(retry?.textContent?.trim()).toBe('Prøv igen');
    expect(root.querySelector('app-ui-empty-state')).toBeNull();

    retry?.click();
    expectPage().flush(page(EVENTS));
    fixture.detectChanges();

    expect(root.querySelector('app-ui-form-error')).toBeNull();
    expect(root.querySelectorAll('.history-page__row')).toHaveLength(EVENTS.length);
  });

  it('viser gen-log-knappen på måltider og melder "Logget i dag", når rækken er gemt', () => {
    const fixture = setup();
    const root = rootOf(fixture);
    expectPage().flush(page(EVENTS));
    fixture.detectChanges();
    const relog = root.querySelector<HTMLButtonElement>('.history-page__relog');
    expect(root.querySelectorAll('.history-page__relog')).toHaveLength(1);
    expect(relog?.getAttribute('aria-label')).toBe('Log igen i dag');

    relog?.click();
    relog?.click();
    fixture.detectChanges();
    // The meal isn't in the (empty) catalogue, so add() creates the food before it logs it.
    http
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush(testFood({ foodId: 1, name: TEST_FOOD.name }));
    http.expectOne({ method: 'POST', url: '/api/v1/me/food-logs' }).flush(MEAL);
    fixture.detectChanges();

    const updated = root.querySelector<HTMLButtonElement>('.history-page__relog');
    expect(updated?.getAttribute('aria-label')).toBe('Logget i dag');
    expect(updated?.classList.contains('history-page__relog--done')).toBe(true);

    // The page's service clears the 2.6-second timer when the page closes.
    fixture.destroy();
  });

  it('skifter gen-log-ikonet til et kryds, når logningen fejler', () => {
    const fixture = setup();
    expectPage().flush(page(EVENTS));
    fixture.detectChanges();
    const icon = (): string =>
      fixture.debugElement
        .query(By.css('.history-page__relog app-ui-icon'))
        .injector.get(UiIcon)
        .name();
    expect(icon()).toBe('redo');

    rootOf(fixture).querySelector<HTMLButtonElement>('.history-page__relog')?.click();
    http
      .expectOne({ method: 'POST', url: '/api/v1/foods' })
      .flush(null, { status: 500, statusText: 'Error' });
    fixture.detectChanges();

    const relog = rootOf(fixture).querySelector<HTMLButtonElement>('.history-page__relog');
    expect(relog?.getAttribute('aria-label')).toBe('Ikke logget – prøv igen');
    expect(relog?.classList.contains('history-page__relog--failed')).toBe(true);
    expect(icon()).toBe('close');

    fixture.destroy();
  });
});
