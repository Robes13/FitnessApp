import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { FoodItem } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { UserProfile } from '../../../core/models/profile';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { WeightLogDto } from '../../../core/models/weight';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { FoodLogDto } from '../../../core/models/food-api';
import {
  TEST_FOOD,
  flushTestFoodLog,
  flushTestGoal,
  flushTestWeighIns,
  testFoodLog,
  weighHistory,
  weightLogDto,
} from '../../../core/testing/fixtures';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { NOW } from '../../../core/utils/now';
import { HOME_HISTORY_DAYS, HomeSummaryService, TODAY_INDEX } from './home-summary';

/** Thursday, September 24, 2026 – the rolling week runs from Friday the 18th to today. */
const THURSDAY = new Date(2026, 8, 24, 10, 30);
/** Index of Tuesday the 22nd and Wednesday the 23rd in the rolling week. */
const TUESDAY_INDEX = 4;
const WEDNESDAY_INDEX = 5;
const RING_CIRCUMFERENCE = 100.5;
const SERVER_ERROR = { status: 500, statusText: 'Server Error' };
const EMPTY_PAGE = { items: [], nextCursor: null, hasMore: false };

/** The three API stores Home reads, each with its own load. */
type LoadingStore = Pick<FoodLogService, 'load' | 'status'>;
const STORES: readonly (readonly [string, () => LoadingStore])[] = [
  ['the food log', () => TestBed.inject(FoodLogService)],
  ['the weigh-ins', () => TestBed.inject(WeightLogService)],
  ['the profile', () => TestBed.inject(UserProfileService)],
];

const SKYR: FoodItem = {
  id: 'f-skyr',
  name: 'Skyr-bowl',
  quantity: '250 g',
  kcal: 380,
  protein: 32,
  carbs: 38,
  fat: 9,
};
const SALAT: FoodItem = {
  id: 'f-salat',
  name: 'Kyllingesalat',
  quantity: '1 portion',
  kcal: 450,
  protein: 41,
  carbs: 18,
  fat: 22,
};

describe('HomeSummaryService', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  let storage: FakeStorage;
  let profilePatch: Partial<UserProfile>;
  let foodLogs: FoodLogDto[];
  let weighIns: readonly WeightLogDto[];

  /** The profile `setup()` gives the user, on top of the API's goal. */
  function storeProfile(patch: Partial<UserProfile>): void {
    profilePatch = patch;
  }

  /** Puts meals on today's log, as if the user had logged them themselves. */
  function storeFoodLog(entries: readonly (FoodItem & { meal: MealId })[]): void {
    foodLogs.push(...entries.map(({ meal, ...food }) => testFoodLog(food, meal, THURSDAY)));
  }

  /** Puts meals on earlier days, keyed by `YYYY-MM-DD`. */
  function storeFoodDays(days: Record<string, readonly FoodItem[]>): void {
    for (const [date, foods] of Object.entries(days)) {
      foodLogs.push(
        ...foods.map((food) => testFoodLog(food, 'frokost', new Date(`${date}T12:00:00`))),
      );
    }
  }

  function storeWeighHistory(): void {
    weighIns = weighHistory(THURSDAY);
  }

  /** Today's weigh-in, as if the user had just weighed in. */
  function weighInToday(): void {
    flushTestWeighIns([weightLogDto(1, 74.2, 0, THURSDAY)]);
  }

  /** Every store loaded from the API, as after sign-in. */
  function setup(now: () => Date = () => new Date(THURSDAY)): HomeSummaryService {
    TestBed.configureTestingModule({
      providers: [...provideCoreTestEnvironment({ storage }), { provide: NOW, useValue: now }],
    });
    flushTestGoal();
    flushTestWeighIns(weighIns);
    TestBed.inject(UserProfileService).update(profilePatch);
    flushTestFoodLog([], foodLogs);
    return TestBed.inject(HomeSummaryService);
  }

  /** Starts the store's load and fails its first request; the others are cancelled. */
  function failLoad(store: LoadingStore): void {
    store.load().subscribe();
    TestBed.inject(HttpTestingController)
      .match(() => true)[0]
      ?.flush(null, SERVER_ERROR);
  }

  beforeEach(() => {
    storage = createFakeStorage();
    profilePatch = {};
    foodLogs = [];
    weighIns = [];
  });

  it('labels today from the injected date and selects it', () => {
    const service = setup();

    expect(service.todayLabel()).toBe('Torsdag 24. sep');
    expect(service.selectedDay()).toBe(TODAY_INDEX);
  });

  it('greets without a name until the profile has one', () => {
    const service = setup();

    expect(service.hasName()).toBe(false);

    TestBed.inject(UserProfileService).update({ username: 'Ida' });

    expect(service.hasName()).toBe(true);
  });

  it('rolls the rings over the last seven days with today last', () => {
    storeFoodLog([{ ...SKYR, meal: 'morgen' }]);
    const service = setup();
    const rings = service.weekRings();

    expect(rings.map((ring) => ring.label)).toEqual([
      'Fre',
      'Lør',
      'Søn',
      'Man',
      'Tir',
      'Ons',
      'Tor',
    ]);
    expect(rings[0]?.tone).toBe('none');
    expect(rings[0]?.dashOffset).toBeCloseTo(RING_CIRCUMFERENCE, 3);
    expect(rings[WEDNESDAY_INDEX]?.tone).toBe('none');
    expect(rings[TODAY_INDEX]?.tone).toBe('accent');
    expect(rings[TODAY_INDEX]?.isToday).toBe(true);
    expect(rings[TODAY_INDEX]?.isSelected).toBe(true);
    expect(rings.filter((ring) => ring.isToday)).toHaveLength(1);
  });

  it('shows the kcal and macros of an earlier logged day', () => {
    // Tuesday and Wednesday before Thursday, 24 September 2026.
    storeFoodDays({ '2026-09-22': [SKYR, SALAT], '2026-09-23': [SALAT] });
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;

    const rings = service.weekRings();
    expect(rings[TUESDAY_INDEX - 1]?.tone).toBe('none');
    expect(rings[TUESDAY_INDEX]?.tone).toBe('accent');
    expect(rings[TUESDAY_INDEX]?.dashOffset).toBeCloseTo(
      RING_CIRCUMFERENCE * (1 - 830 / target),
      3,
    );
    expect(rings[WEDNESDAY_INDEX]?.tone).toBe('accent');
    expect(rings[TODAY_INDEX]?.tone).toBe('none');

    service.selectDay(TUESDAY_INDEX);
    const summary = service.daySummary();
    expect(summary.kcalEatenText).toBe('830');
    expect(summary.progressTone).toBe('accent');
    expect(summary.macros[0]?.text.startsWith('73 / ')).toBe(true);

    expect(service.weekSummary().averageKcalText).toBe('640');
  });

  it('titles the selected day relative to today', () => {
    const service = setup();

    expect(service.daySummary().title).toBe('Torsdag · i dag');

    service.selectDay(WEDNESDAY_INDEX);
    expect(service.daySummary().title).toBe('Onsdag · i går');

    service.selectDay(TUESDAY_INDEX);
    expect(service.daySummary().title).toBe('Tirsdag');

    service.selectDay(0);
    expect(service.daySummary().title).toBe('Fredag');
  });

  it('shows the logged totals for today', () => {
    storeFoodLog([
      { ...SKYR, meal: 'morgen' },
      { ...SALAT, meal: 'frokost' },
    ]);
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;
    const summary = service.daySummary();

    // 380 + 450 kcal and 32 + 41 g protein.
    expect(summary.kcalEatenText).toBe('830');
    expect(summary.kcalTargetText).toBe('2.500');
    expect(summary.progress).toBeCloseTo(830 / target, 5);
    expect(summary.progressTone).toBe('accent');
    expect(summary.macros.map((macro) => macro.label)).toEqual(['Protein', 'Kulhydrat', 'Fedt']);
    expect(summary.macros[0]?.text.startsWith('73 / ')).toBe(true);
  });

  it('shows a dash for every day without data', () => {
    const service = setup();

    for (const day of [1, 3, WEDNESDAY_INDEX]) {
      service.selectDay(day);
      const summary = service.daySummary();

      expect(summary.progress).toBe(0);
      expect(summary.progressTone).toBe('muted');
      expect(summary.kcalEatenText).toBe('–');
      expect(summary.weightText).toBe('–');
      expect(summary.macros.every((macro) => macro.text.startsWith('– / '))).toBe(true);
    }
  });

  it('shows 0 for today once the food log has loaded – a dash while it loads', () => {
    const service = setup();
    TestBed.inject(FoodLogService).load().subscribe();

    expect(service.daySummary().kcalEatenText).toBe('–');

    for (const request of TestBed.inject(HttpTestingController).match(() => true)) {
      request.flush(EMPTY_PAGE);
    }
    const today = service.daySummary();

    expect(today.kcalEatenText).toBe('0');
    expect(today.macros.every((macro) => macro.text.startsWith('0 / '))).toBe(true);
    expect(service.weekRings()[TODAY_INDEX]?.tone).toBe('none');
    // Only today counts as 0 – the week's numbers still have no logged day.
    expect(service.weekSummary().note).toBe('Ingen dage logget de seneste 7 dage.');
    service.selectDay(WEDNESDAY_INDEX);
    expect(service.daySummary().kcalEatenText).toBe('–');
  });

  it('shows the weighing of an earlier day when there is one', () => {
    storeWeighHistory();
    const service = setup();

    // The most recent weigh-in is three days before Thursday, i.e. on Monday.
    service.selectDay(TUESDAY_INDEX - 1);
    expect(service.daySummary().weightText).toBe('75,0');

    service.selectDay(TUESDAY_INDEX);
    expect(service.daySummary().weightText).toBe('–');
  });

  it('claims no numbers, next steps or goal card until the stores have loaded', () => {
    TestBed.configureTestingModule({
      providers: provideCoreTestEnvironment({ storage, now: THURSDAY }),
    });
    TestBed.inject(FoodLogService).addLogs([testFoodLog(SKYR, 'morgen', THURSDAY)]);
    const service = TestBed.inject(HomeSummaryService);

    expect(service.weekSummary()).toEqual({
      hitText: '–',
      proteinHitText: '–',
      streakText: '–',
      averageKcalText: '–',
      note: '',
    });
    expect(service.daySummary().kcalTargetText).toBe('–');
    expect(service.daySummary().macros[0]?.text).toBe('32 / – g');
    expect(service.dayRows()[0]?.kcalText).toBe('380 / – kcal');
    expect(service.todos()).toEqual([]);
    expect(service.showGoalCard()).toBe(false);
  });

  it('averages the real kcal, also on days above the goal', () => {
    storeFoodDays({
      '2026-09-22': [{ ...TEST_FOOD, kcal: 3200 }],
      '2026-09-23': [{ ...TEST_FOOD, kcal: 1000 }],
    });

    expect(setup().weekSummary().averageKcalText).toBe('2.100');
  });

  it('counts only the days that have data in the week card', () => {
    const service = setup();

    expect(service.weekSummary()).toEqual({
      hitText: '0',
      proteinHitText: '0',
      streakText: '0 dage',
      averageKcalText: '–',
      note: 'Ingen dage logget de seneste 7 dage.',
    });
  });

  it('counts today once the calorie target is met', () => {
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;
    TestBed.inject(FoodLogService).addLogs([
      testFoodLog({ ...TEST_FOOD, kcal: target, protein: 500 }, 'aften', THURSDAY),
    ]);

    expect(service.weekSummary()).toMatchObject({
      hitText: '1',
      proteinHitText: '1',
      streakText: '1 dag',
      note: 'Stærk uge – bliv ved.',
    });
  });

  it('lists weighing and every unlogged meal as next steps', () => {
    const service = setup();

    expect(service.todos().map((todo) => todo.title)).toEqual([
      'Husk at veje dig i dag',
      'Log din morgenmad',
      'Log din frokost',
      'Log din aftensmad',
      'Log din snacks',
    ]);
    expect(service.nextTodo()).toEqual({
      title: 'Husk at veje dig i dag',
      subtitle: 'Tryk her for at registrere din vægt',
      path: APP_PATH.WEIGHT,
      queryParams: null,
    });
    expect(service.todoCountLabel()).toBe('1 / 5');
  });

  it('sends a meal step to Mad with the meal as a query parameter', () => {
    storeFoodLog([
      { ...SKYR, meal: 'morgen' },
      { ...SALAT, meal: 'frokost' },
    ]);
    const service = setup();
    weighInToday();

    const todo = service.nextTodo();

    expect(todo?.title).toBe('Log din aftensmad');
    expect(todo?.path).toBe(APP_PATH.FOOD);
    expect(todo?.queryParams).toEqual({ [QUERY_PARAM.ADD_MEAL]: 'aften' });
    expect(service.todoCountLabel()).toBe('1 / 2');
  });

  it('has no next step when everything is logged and weighed', () => {
    storeFoodLog([
      { ...SKYR, meal: 'morgen' },
      { ...SALAT, meal: 'frokost' },
    ]);
    const service = setup();
    const foodLog = TestBed.inject(FoodLogService);
    weighInToday();

    foodLog.addLogs([
      testFoodLog(TEST_FOOD, 'aften', THURSDAY),
      testFoodLog(TEST_FOOD, 'snack', THURSDAY),
    ]);

    expect(service.todos()).toEqual([]);
    expect(service.nextTodo()).toBeNull();
    expect(service.todoCountLabel()).toBe('Kun én');
  });

  it('asks for a weigh-in again once the day has moved on', () => {
    vi.useFakeTimers();
    try {
      let now = new Date(THURSDAY);
      const service = setup(() => new Date(now));
      weighInToday();
      expect(service.nextTodo()?.title).toBe('Log din morgenmad');

      const midnight = new Date(2026, 8, 25);
      now = midnight;
      vi.advanceTimersByTime(midnight.getTime() - THURSDAY.getTime());

      expect(service.nextTodo()?.title).toBe('Husk at veje dig i dag');
    } finally {
      vi.useRealTimers();
    }
  });

  it('celebrates when the day reaches the calorie target', () => {
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;

    expect(service.goalReached()).toBe(false);

    TestBed.inject(FoodLogService).addLogs([
      testFoodLog({ ...TEST_FOOD, kcal: target }, 'aften', THURSDAY),
    ]);

    expect(service.goalReached()).toBe(true);
    expect(service.daySummary().progressTone).toBe('positive');
  });

  it('lists the last 30 days newest first with a dash for days without entries', () => {
    const big = { ...TEST_FOOD, kcal: 1850.4, protein: 120.4, carbs: 200, fat: 60 };
    storeFoodLog([{ ...SKYR, meal: 'morgen' }]);
    // The 26th of August is the oldest of the 30 days, the 25th is one too many.
    storeFoodDays({ '2026-09-22': [SKYR, SALAT], '2026-08-26': [big], '2026-08-25': [big] });
    const rows = setup().dayRows();

    expect(rows).toHaveLength(HOME_HISTORY_DAYS);
    expect(rows[0]).toEqual({
      id: '2026-09-24',
      label: 'Tor. 24. sep',
      kcalText: '380 / 2.500 kcal',
      macroText: 'P 32 g · K 38 g · F 9 g',
    });
    expect(rows[1]).toEqual({
      id: '2026-09-23',
      label: 'Ons. 23. sep',
      kcalText: '–',
      macroText: '',
    });
    expect(rows[2]?.kcalText).toBe('830 / 2.500 kcal');
    expect(rows.at(-1)).toEqual({
      id: '2026-08-26',
      label: 'Ons. 26. aug',
      kcalText: '1.850 / 2.500 kcal',
      macroText: 'P 120 g · K 200 g · F 60 g',
    });
  });

  it("adds up the API's exact values and rounds each day once", () => {
    // 3 × 110 g of 12 / 25 / 6 g per 100 g: exactly P 39.6 · K 82.5 · F 19.8 (and 301.2 kcal).
    const portion = { ...TEST_FOOD, quantity: '110 g', kcal: 100.4, protein: 13.2, carbs: 27.5 };
    storeFoodLog([1, 2, 3].map(() => ({ ...portion, fat: 6.6, meal: 'frokost' as const })));
    const service = setup();

    expect(service.dayRows()[0]).toMatchObject({
      kcalText: '301 / 2.500 kcal',
      macroText: 'P 40 g · K 83 g · F 20 g',
    });
    expect(service.daySummary().kcalEatenText).toBe('301');
    expect(service.daySummary().macros.map((macro) => macro.text)).toEqual([
      '39,6 / 188 g',
      '82,5 / 250 g',
      '19,8 / 83 g',
    ]);
  });

  for (const [name, store] of STORES) {
    it(`offers "Prøv igen" when ${name} failed to load and reloads only that store`, () => {
      const service = setup();

      expect(service.loadFailed()).toBe(false);
      failLoad(store());
      expect(service.loadFailed()).toBe(true);

      const loads = STORES.map(([, other]) =>
        vi.spyOn(other(), 'load').mockReturnValue(of(undefined)),
      );
      service.reload();

      expect(loads.map((load) => load.mock.calls.length)).toEqual(
        STORES.map(([other]) => (other === name ? 1 : 0)),
      );
    });
  }

  it('describes the way to the goal weight', () => {
    storeProfile({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });
    storeWeighHistory();
    const service = setup();

    const goal = service.goalSummary();

    expect(service.showGoalCard()).toBe(true);
    expect(goal.toGoalText).toBe('5,0 kg');
    expect(goal.goalWeightText).toBe('70');
    expect(goal.coach).toBe('Med dit tempo på 0,5 kg/uge er du der om ca. 10 uger.');
    // The starting weight is the oldest weigh-in, 76.1 kg.
    expect(goal.progress).toBeCloseTo(1 - 5 / 6.1, 5);
  });

  it('says "1 uge" in the singular', () => {
    storeProfile({ goal: 'tabe', weightKg: 75, goalWeightKg: 74.6 });
    const service = setup();

    expect(service.goalSummary().coach).toBe('Med dit tempo på 0,5 kg/uge er du der om ca. 1 uge.');
  });

  it('falls back to the profile weight when nothing is weighed yet', () => {
    storeProfile({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });
    const service = setup();

    expect(service.goalSummary().toGoalText).toBe('5,0 kg');
  });

  it('hides the goal card when the goal is to maintain', () => {
    storeProfile({ goal: 'hold' });
    const service = setup();

    expect(service.showGoalCard()).toBe(false);
  });

  it('says the goal is reached when the weight is there', () => {
    storeProfile({ goal: 'tabe', weightKg: 70, goalWeightKg: 70 });
    const service = setup();

    expect(service.goalSummary().toGoalText).toBe('Nået!');
    expect(service.goalSummary().coach).toBe(
      'Du har ramt dit mål – overvej at skifte til "Holde vægten".',
    );
  });
});
