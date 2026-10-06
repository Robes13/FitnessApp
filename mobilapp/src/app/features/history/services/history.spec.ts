import { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CursorPage } from '../../../core/models/api';
import { FoodLogDto } from '../../../core/models/food-api';
import { UserGoalDto } from '../../../core/models/profile-api';
import { WeightLogDto } from '../../../core/models/weight';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { injectTranslate } from '../../../core/services/language/translate';
import {
  TEST_FOOD,
  TEST_GOAL,
  flushTestFoodLog,
  testFood,
  testFoodLog,
  weightLogDto,
} from '../../../core/testing/fixtures';
import { TEST_NOW, provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { HistoryEntry, HistoryEventDto, HistoryFilter, HistoryFilterId } from '../models/history';
import {
  HISTORY_FILTERS,
  HistoryService,
  RELOGGED_DURATION_MS,
  RELOGGED_LABEL_KEY,
  RELOG_FAILED_LABEL_KEY,
  RELOG_LABEL_KEY,
} from './history';

const HISTORY_URL = '/api/v1/me/history';
const ALL_TYPES = 'AccountCreated,GoalUpdated,FoodLogged,WeightRecorded';

/** `daysAgo` days before `TEST_NOW` at `hour` o'clock, local time. */
function daysAgo(days: number, hour = 9): Date {
  return new Date(TEST_NOW.getFullYear(), TEST_NOW.getMonth(), TEST_NOW.getDate() - days, hour);
}

const NO_PAYLOAD = { foodLog: null, weightLog: null, goal: null };

function foodEvent(foodLog: FoodLogDto): HistoryEventDto {
  return {
    type: 'FoodLogged',
    occurredAt: foodLog.consumedAt,
    referenceId: foodLog.foodLogId,
    ...NO_PAYLOAD,
    foodLog,
  };
}

function weighEvent(weightLog: WeightLogDto): HistoryEventDto {
  return {
    type: 'WeightRecorded',
    occurredAt: weightLog.recordedAt,
    referenceId: weightLog.weightLogId,
    ...NO_PAYLOAD,
    weightLog,
  };
}

function goalEvent(goal: UserGoalDto): HistoryEventDto {
  return {
    type: 'GoalUpdated',
    occurredAt: goal.createdAt,
    referenceId: goal.userGoalId,
    ...NO_PAYLOAD,
    goal,
  };
}

function accountEvent(occurredAt: string): HistoryEventDto {
  return { type: 'AccountCreated', occurredAt, referenceId: 1, ...NO_PAYLOAD };
}

/** The sign-up: the API creates the account and its first goal with the same timestamp. */
const SIGN_UP_GOAL = goalEvent(TEST_GOAL);
const ACCOUNT_CREATED = accountEvent(TEST_GOAL.createdAt);
/** A goal change after the sign-up. */
const LATER_GOAL = goalEvent({
  ...TEST_GOAL,
  userGoalId: 8,
  goalType: 'MaintainWeight',
  targetDailyCalories: 2345.6,
  createdAt: daysAgo(2).toISOString(),
});

function page(
  items: HistoryEventDto[],
  nextCursor: string | null = null,
): CursorPage<HistoryEventDto> {
  return { items, nextCursor, hasMore: nextCursor !== null };
}

function filterOf(id: HistoryFilterId): HistoryFilter {
  const filter = HISTORY_FILTERS.find((candidate) => candidate.id === id);
  if (!filter) {
    throw new Error(`Intet filter med id "${id}".`);
  }
  return filter;
}

/** The id a loaded event gets as an entry – how the specs tell which events are loaded. */
function entryId(event: HistoryEventDto): string {
  return `${event.type}-${event.referenceId}`;
}

function loadedIds(history: HistoryService): readonly string[] {
  return history.entries().map((entry) => entry.id);
}

function titles(history: HistoryService): readonly string[] {
  return history.entries().map((entry) => entry.title);
}

function findEntry(history: HistoryService, title: string): HistoryEntry {
  const entry = history.entries().find((candidate) => candidate.title === title);
  if (!entry) {
    throw new Error(`Fandt ingen post med titlen "${title}".`);
  }
  return entry;
}

describe('HistoryService', () => {
  let history: HistoryService;
  let http: HttpTestingController;

  /** The request for one page – the URL with exactly these params, in this order. */
  function expectPage(types = ALL_TYPES, cursor?: string): TestRequest {
    const query = `types=${types}&limit=50${cursor === undefined ? '' : `&cursor=${cursor}`}`;
    return http.expectOne({ method: 'GET', url: `${HISTORY_URL}?${query}` });
  }

  /** Opens the history (the page calls `loadMore()`) and answers the first page. */
  function open(items: HistoryEventDto[], nextCursor: string | null = null): void {
    history.loadMore();
    expectPage().flush(page(items, nextCursor));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...provideCoreTestEnvironment(), HistoryService],
    });
    history = TestBed.inject(HistoryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('sider og filtre', () => {
    it('henter intet, før siden beder om det, og så første side med alle typer undtagen præstationer', () => {
      expect(history.status()).toBe('idle');

      history.loadMore();
      expect(history.status()).toBe('loading');
      expectPage().flush(page([ACCOUNT_CREATED]));

      expect(history.status()).toBe('ready');
      expect(loadedIds(history)).toEqual([entryId(ACCOUNT_CREATED)]);
    });

    it('sender filterets typer som types', () => {
      for (const [id, types] of [
        ['vejning', 'WeightRecorded'],
        ['mad', 'FoodLogged'],
        ['maal', 'GoalUpdated'],
        ['alle', ALL_TYPES],
      ] as const) {
        history.setFilter(filterOf(id));
        expect(history.filter()).toBe(id);
        expectPage(types).flush(page([]));
      }
    });

    it('sender nextCursor med, når næste side hentes, og lægger den efter den første', () => {
      const today = weighEvent(weightLogDto(1, 75, 0, TEST_NOW));
      const older = weighEvent(weightLogDto(2, 76, 5, TEST_NOW));
      open([today], 'c2');

      history.loadMore();
      expectPage(ALL_TYPES, 'c2').flush(page([older]));

      expect(loadedIds(history)).toEqual([today, older].map(entryId));
      history.loadMore();
      http.expectNone(() => true);
    });

    it('beder ikke om en side, mens en indlæses, eller efter den sidste', () => {
      history.loadMore();
      history.loadMore();
      expectPage().flush(page([ACCOUNT_CREATED]));

      history.loadMore();
      http.expectNone(() => true);
    });

    it('starter forfra ved filterskift og dropper en side på vej', () => {
      open([weighEvent(weightLogDto(1, 75, 0, TEST_NOW))], 'c2');
      history.loadMore();
      const pending = expectPage(ALL_TYPES, 'c2');

      history.setFilter(filterOf('mad'));

      expect(pending.cancelled).toBe(true);
      expect(loadedIds(history)).toEqual([]);
      expect(history.status()).toBe('loading');
      const meal = foodEvent(testFoodLog(TEST_FOOD, 'aften'));
      expectPage('FoodLogged').flush(page([meal]));
      expect(loadedIds(history)).toEqual([entryId(meal)]);
    });

    it('melder fejl, beder ikke selv igen og henter den fejlede side ved retry()', () => {
      const today = weighEvent(weightLogDto(1, 75, 0, TEST_NOW));
      open([today], 'c2');
      history.loadMore();
      expectPage(ALL_TYPES, 'c2').flush(null, { status: 500, statusText: 'Error' });

      expect(history.status()).toBe('error');
      expect(loadedIds(history)).toEqual([entryId(today)]);
      history.loadMore();
      http.expectNone(() => true);

      history.retry();
      expect(history.status()).toBe('loading');
      expectPage(ALL_TYPES, 'c2').flush(page([ACCOUNT_CREATED]));

      expect(history.status()).toBe('ready');
      expect(loadedIds(history)).toEqual([today, ACCOUNT_CREATED].map(entryId));
    });

    it('er kun tom, når siden er hentet uden poster', () => {
      history.setFilter(filterOf('maal'));
      expect(history.isEmpty()).toBe(false);

      expectPage('GoalUpdated').flush(page([]));

      expect(history.isEmpty()).toBe(true);
      expect(history.groups()).toEqual([]);
    });

    it('beholder de hentede sider, når det valgte filter vælges igen', () => {
      const today = weighEvent(weightLogDto(1, 75, 0, TEST_NOW));
      open([today], 'c2');

      history.setFilter(filterOf('alle'));

      http.expectNone(() => true);
      expect(loadedIds(history)).toEqual([entryId(today)]);
      expect(history.status()).toBe('ready');
    });
  });

  describe('poster', () => {
    it('viser vejningen med vægten, og kun den første får "Seneste vejning"', () => {
      open([
        weighEvent(weightLogDto(1, 75, 0, TEST_NOW)),
        weighEvent(weightLogDto(2, 75.6, 3, TEST_NOW)),
      ]);

      const entries = history.entries();
      expect(entries.map((entry) => entry.kind)).toEqual(['vejning', 'vejning']);
      expect(entries.map((entry) => entry.title)).toEqual(['Vejning', 'Vejning']);
      expect(entries.map((entry) => entry.value)).toEqual(['75,0 kg', '75,6 kg']);
      expect(entries.map((entry) => entry.subtitle)).toEqual([
        'Seneste vejning',
        'Vejning registreret',
      ]);
    });

    it('viser et måltid med navn, måltid og kalorier og kan logge det igen', () => {
      open([foodEvent(testFoodLog(TEST_FOOD, 'aften', daysAgo(1)))]);

      const entry = findEntry(history, 'Proteinbar');
      expect(entry.kind).toBe('mad');
      expect(entry.subtitle).toBe('Aftensmad');
      expect(entry.value).toBe('210 kcal');
      expect(entry.when).toBe('I går');
      expect(entry.meal).toBe('aften');
      expect(entry.food?.kcal).toBe(210);
    });

    it('skriver et måltids kalorier fra 1000 og op med tusindtalsseparator', () => {
      open([foodEvent(testFoodLog({ ...TEST_FOOD, name: 'Festmåltid', kcal: 1600 }, 'snack'))]);

      expect(findEntry(history, 'Festmåltid').value).toBe('1.600 kcal');
    });

    it('viser en målændring med målet og det afrundede kaloriemål', () => {
      open([LATER_GOAL, SIGN_UP_GOAL, ACCOUNT_CREATED]);

      const entry = findEntry(history, 'Mål opdateret');
      expect(entry.kind).toBe('maal');
      expect(entry.subtitle).toBe('Holde vægten');
      expect(entry.value).toBe('2.346 kcal');
      expect(entry.food).toBeUndefined();
    });

    it('viser kun "Konto oprettet" for en ny konto – registreringens mål skjules', () => {
      open([SIGN_UP_GOAL, ACCOUNT_CREATED]);

      expect(history.entries()).toHaveLength(1);
      const [account] = history.entries();
      expect(account?.kind).toBe('konto');
      expect(account?.title).toBe('Konto oprettet');
      expect(account?.value).toBe('');
    });

    it('skjuler registreringens mål, også når kontoen først kommer på næste side', () => {
      open([weighEvent(weightLogDto(1, 75, 0, TEST_NOW)), SIGN_UP_GOAL], 'c2');
      expect(titles(history)).toEqual(['Vejning', 'Mål opdateret']);

      history.loadMore();
      expectPage(ALL_TYPES, 'c2').flush(page([ACCOUNT_CREATED]));

      expect(titles(history)).toEqual(['Vejning', 'Konto oprettet']);
    });

    it('beholder senere målændringer og viser det første mål under "Mål"', () => {
      open([LATER_GOAL, SIGN_UP_GOAL, ACCOUNT_CREATED]);
      expect(titles(history)).toEqual(['Mål opdateret', 'Konto oprettet']);

      history.setFilter(filterOf('maal'));
      expectPage('GoalUpdated').flush(page([LATER_GOAL, SIGN_UP_GOAL]));

      expect(titles(history)).toEqual(['Mål opdateret', 'Mål opdateret']);
    });

    it('grupperer pr. dag, nyeste først, med designets etiketter', () => {
      open([
        weighEvent(weightLogDto(1, 75, 0, TEST_NOW)),
        foodEvent(testFoodLog(TEST_FOOD, 'morgen', daysAgo(0, 8))),
        foodEvent(testFoodLog(TEST_FOOD, 'aften', daysAgo(2))),
      ]);

      expect(history.groups().map((group) => group.label)).toEqual([
        'I dag · 21. sep',
        'Lør. · 19. sep',
      ]);
      expect(history.groups()[0]?.entries).toHaveLength(2);
    });
  });

  describe('dagens madopsummering', () => {
    it('summerer dagens måltider fra payloaden og udelader dage uden måltider', () => {
      open([
        weighEvent(weightLogDto(1, 75, 0, TEST_NOW)),
        foodEvent(testFoodLog(TEST_FOOD, 'aften', daysAgo(1, 18))),
        foodEvent(testFoodLog(TEST_FOOD, 'frokost', daysAgo(1, 12))),
      ]);

      expect(history.groups().map((group) => group.foodSummary)).toEqual([
        null,
        '420 kcal · P 40 g · K 44 g · F 14 g',
      ]);
    });

    it('venter med den sidste dag, til næste side er hentet', () => {
      open(
        [
          foodEvent(testFoodLog(TEST_FOOD, 'morgen', daysAgo(0, 8))),
          foodEvent(testFoodLog(TEST_FOOD, 'aften', daysAgo(1, 18))),
        ],
        'c2',
      );
      expect(history.groups().map((group) => group.foodSummary)).toEqual([
        '210 kcal · P 20 g · K 22 g · F 7 g',
        null,
      ]);

      history.loadMore();
      expectPage(ALL_TYPES, 'c2').flush(
        page([foodEvent(testFoodLog(TEST_FOOD, 'frokost', daysAgo(1, 12)))]),
      );

      expect(history.groups()[1]?.foodSummary).toBe('420 kcal · P 40 g · K 44 g · F 14 g');
    });
  });

  describe('gen-log', () => {
    /** The meal in the catalogue (so `add()` only posts the log) and in the history. */
    function openWithMeal(): { entry: HistoryEntry; logged: FoodLogDto } {
      const logged = testFoodLog(TEST_FOOD, 'aften', daysAgo(1));
      flushTestFoodLog([testFood({ foodId: logged.foodId, name: TEST_FOOD.name })]);
      open([foodEvent(logged)]);
      return { entry: findEntry(history, 'Proteinbar'), logged };
    }

    function expectLogPost(): TestRequest {
      return http.expectOne({ method: 'POST', url: '/api/v1/me/food-logs' });
    }

    it('logger måltidet én gang i dag og viser "Logget i dag" i 2,6 sekunder', () => {
      vi.useFakeTimers();
      try {
        const { entry, logged } = openWithMeal();
        const t = TestBed.runInInjectionContext(() => injectTranslate());

        history.relog(entry);
        history.relog(entry);
        expect(history.relogState(entry)).toBe('pending');
        const post = expectLogPost();
        expect(post.request.body).toMatchObject({ foodId: logged.foodId, mealType: 'Dinner' });
        post.flush({
          ...logged,
          foodLogId: logged.foodLogId + 1000,
          consumedAt: TEST_NOW.toISOString(),
        });

        expect(
          TestBed.inject(FoodLogService)
            .entries()
            .map((food) => food.meal),
        ).toEqual(['aften']);
        expect(history.relogState(entry)).toBe('logged');
        expect(history.relogLabel(entry)).toBe(t(RELOGGED_LABEL_KEY));

        vi.advanceTimersByTime(RELOGGED_DURATION_MS);

        expect(history.relogState(entry)).toBeNull();
        expect(history.relogLabel(entry)).toBe(t(RELOG_LABEL_KEY));
      } finally {
        vi.useRealTimers();
      }
    });

    it('viser i 2,6 sekunder, at gen-logningen fejlede', () => {
      vi.useFakeTimers();
      try {
        const { entry } = openWithMeal();
        const t = TestBed.runInInjectionContext(() => injectTranslate());

        history.relog(entry);
        expectLogPost().flush(null, { status: 500, statusText: 'Error' });

        expect(history.relogState(entry)).toBe('failed');
        expect(history.relogLabel(entry)).toBe(t(RELOG_FAILED_LABEL_KEY));

        vi.advanceTimersByTime(RELOGGED_DURATION_MS);
        expect(history.relogState(entry)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('logger hvert måltid én gang og viser det sidste svar i hele 2,6 sekunder, når to gen-logs overlapper', () => {
      vi.useFakeTimers();
      try {
        const logs = [
          testFoodLog(TEST_FOOD, 'aften', daysAgo(1)),
          testFoodLog(TEST_FOOD, 'frokost', daysAgo(1)),
        ];
        flushTestFoodLog([testFood({ foodId: 1, name: TEST_FOOD.name })]);
        open(logs.map(foodEvent));
        const [first, second] = history.entries();
        if (!first || !second) {
          throw new Error('Forventede to måltider.');
        }

        history.relog(first);
        history.relog(second);
        history.relog(first);
        const posts = http.match({ method: 'POST', url: '/api/v1/me/food-logs' });
        expect(posts).toHaveLength(2);
        const [postFirst, postSecond] = posts;
        expect(history.relogState(first)).toBe('pending');

        postFirst?.flush({ ...logs[0], foodLogId: 1001 });
        expect(history.relogState(first)).toBe('logged');
        expect(history.relogState(second)).toBe('pending');
        history.relog(second);
        http.expectNone({ method: 'POST', url: '/api/v1/me/food-logs' });

        vi.advanceTimersByTime(1000);
        postSecond?.flush({ ...logs[1], foodLogId: 1002 });
        expect(history.relogState(first)).toBeNull();
        expect(history.relogState(second)).toBe('logged');

        vi.advanceTimersByTime(RELOGGED_DURATION_MS - 1);
        expect(history.relogState(second)).toBe('logged');
        vi.advanceTimersByTime(1);
        expect(history.relogState(second)).toBeNull();
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it('rydder timeren, når siden lukkes', () => {
      vi.useFakeTimers();
      try {
        const { entry, logged } = openWithMeal();
        history.relog(entry);
        expectLogPost().flush({ ...logged, foodLogId: logged.foodLogId + 1000 });
        expect(history.relogState(entry)).toBe('logged');

        TestBed.resetTestingModule();

        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
