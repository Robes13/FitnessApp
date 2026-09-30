import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { injectTranslate } from '../../../core/services/language/translate';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { TEST_FOOD, weighEntry } from '../../../core/testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { HistoryEntry } from '../models/history';
import {
  HistoryService,
  RELOGGED_DURATION_MS,
  formatFoodSummary,
  RELOGGED_LABEL_KEY,
  RELOG_LABEL_KEY,
} from './history';

interface Context {
  readonly history: HistoryService;
  readonly foodLog: FoodLogService;
  readonly weightLog: WeightLogService;
}

function findEntry(history: HistoryService, title: string): HistoryEntry {
  const entry = history.entries().find((candidate) => candidate.title === title);
  if (!entry) {
    throw new Error(`Fandt ingen post med titlen "${title}".`);
  }
  return entry;
}

describe('HistoryService', () => {
  let storage: FakeStorage;

  function setup(): Context {
    TestBed.configureTestingModule({
      providers: [...provideCoreTestEnvironment({ storage }), HistoryService],
    });
    return {
      history: TestBed.inject(HistoryService),
      foodLog: TestBed.inject(FoodLogService),
      weightLog: TestBed.inject(WeightLogService),
    };
  }

  /** Two weigh-ins: today and three days ago. */
  function storeWeighings(): void {
    storage.setItem(
      STORAGE_KEY.WEIGHT_LOG,
      JSON.stringify([weighEntry('w-1', 75, 0, TEST_NOW), weighEntry('w-2', 75.6, 3, TEST_NOW)]),
    );
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('er tom, indtil brugeren har registreret noget', () => {
    const { history } = setup();

    expect(history.entries()).toEqual([]);
    expect(history.groups()).toEqual([]);
    expect(history.isEmpty()).toBe(true);
  });

  it('viser vejningerne nyeste først og mærker den seneste', () => {
    storeWeighings();
    const { history } = setup();

    expect(history.entries().map((entry) => entry.value)).toEqual(['75,0 kg', '75,6 kg']);
    expect(history.entries().map((entry) => entry.subtitle)).toEqual([
      'Seneste vejning',
      'Vejning registreret',
    ]);
    expect(history.entries().every((entry) => entry.kind === 'vejning')).toBe(true);
  });

  it('viser dagens måltider med måltidets navn og kalorier', () => {
    const { history, foodLog } = setup();

    foodLog.add(TEST_FOOD, 'aften');

    const entry = findEntry(history, 'Proteinbar');
    expect(entry.kind).toBe('mad');
    expect(entry.subtitle).toBe('Aftensmad');
    expect(entry.value).toBe('210 kcal');
    expect(entry.when).toBe('I dag');
  });

  it('grupperer posterne pr. dag med etiketterne fra designet', () => {
    storeWeighings();
    const { history, foodLog } = setup();
    foodLog.add(TEST_FOOD, 'morgen');

    expect(history.groups().map((group) => group.label)).toEqual([
      'I dag · 21. sep',
      'Fre. · 18. sep',
    ]);
    expect(history.groups()[0]?.entries).toHaveLength(2);
  });

  it('filtrerer på posttype og melder tom, når filteret ikke rammer noget', () => {
    storeWeighings();
    const { history, foodLog } = setup();
    foodLog.add(TEST_FOOD, 'morgen');

    history.setFilter('vejning');
    expect(history.visibleEntries().every((entry) => entry.kind === 'vejning')).toBe(true);
    expect(history.isEmpty()).toBe(false);

    history.setFilter('mad');
    expect(history.visibleEntries().map((entry) => entry.title)).toEqual(['Proteinbar']);

    // Goal changes aren't tracked yet – they'll come from the backend.
    history.setFilter('maal');
    expect(history.visibleEntries()).toEqual([]);
    expect(history.isEmpty()).toBe(true);

    history.setFilter('alle');
    expect(history.visibleEntries()).toHaveLength(history.entries().length);
  });

  it('viser måltider fra tidligere dage med dagens samlede kalorier og makroer', () => {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        days: {
          '2026-09-19': [
            {
              ...TEST_FOOD,
              logId: 'log-1',
              meal: 'frokost',
              loggedAt: new Date(2026, 8, 19, 12).toISOString(),
            },
            {
              ...TEST_FOOD,
              logId: 'log-2',
              meal: 'aften',
              loggedAt: new Date(2026, 8, 19, 18).toISOString(),
            },
          ],
        },
      }),
    );
    const { history, foodLog } = setup();
    foodLog.add(TEST_FOOD, 'morgen');

    const groups = history.groups();
    expect(groups.map((group) => group.label)).toEqual(['I dag · 21. sep', 'Lør. · 19. sep']);
    expect(groups[1]?.entries).toHaveLength(2);
    const t = TestBed.runInInjectionContext(() => injectTranslate());
    expect(groups[1]?.foodSummary).toBe(
      formatFoodSummary(t, foodLog.totalsFor(new Date(2026, 8, 19))),
    );
    expect(groups[1]?.foodSummary).toMatch(/^420 kcal · P /);
  });

  it('viser ingen madopsummering på dage uden måltider', () => {
    storeWeighings();
    const { history } = setup();

    expect(history.groups().every((group) => group.foodSummary === null)).toBe(true);
  });

  it('kun måltidsposter kan logges igen', () => {
    storeWeighings();
    const { history, foodLog } = setup();
    foodLog.add(TEST_FOOD, 'morgen');

    expect(findEntry(history, 'Proteinbar').food?.kcal).toBe(210);
    expect(findEntry(history, 'Vejning').food).toBeUndefined();
  });

  it('logger måltidet igen og viser "Logget i dag" i 2,6 sekunder', () => {
    vi.useFakeTimers();
    try {
      const { history, foodLog } = setup();
      const t = TestBed.runInInjectionContext(() => injectTranslate());
      foodLog.add(TEST_FOOD, 'aften');
      const entry = findEntry(history, 'Proteinbar');

      history.relog(entry);

      expect(foodLog.entries()).toHaveLength(2);
      expect(foodLog.entries().at(-1)?.meal).toBe('aften');
      expect(history.isRelogged(entry)).toBe(true);
      expect(history.relogLabel(entry)).toBe(t(RELOGGED_LABEL_KEY));

      vi.advanceTimersByTime(RELOGGED_DURATION_MS);

      expect(history.isRelogged(entry)).toBe(false);
      expect(history.relogLabel(entry)).toBe(t(RELOG_LABEL_KEY));
    } finally {
      vi.useRealTimers();
    }
  });

  it('rydder "Logget i dag"-timeren, når siden lukkes', () => {
    vi.useFakeTimers();
    try {
      const { history, foodLog } = setup();
      foodLog.add(TEST_FOOD, 'morgen');
      history.relog(findEntry(history, 'Proteinbar'));

      TestBed.resetTestingModule();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
