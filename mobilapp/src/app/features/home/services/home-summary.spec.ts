import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { FoodItem } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';
import { UserProfile } from '../../../core/models/profile';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { WeightLogDto } from '../../../core/models/weight';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import {
  TEST_FOOD,
  flushTestGoal,
  flushTestWeighIns,
  weighHistory,
  weightLogDto,
} from '../../../core/testing/fixtures';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { HomeSummaryService } from './home-summary';

/** Thursday, September 24, 2026 – mid-week, so past, today, and future are all in play. */
const THURSDAY = new Date(2026, 8, 24, 10, 30);
const THURSDAY_INDEX = 3;
const THURSDAY_ISO = '2026-09-24';
const RING_CIRCUMFERENCE = 100.5;

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
  let weighIns: readonly WeightLogDto[];

  /** The profile `setup()` gives the user, on top of the API's goal. */
  function storeProfile(patch: Partial<UserProfile>): void {
    profilePatch = patch;
  }

  /** Puts meals on today's log, as if the user had logged them themselves. */
  function storeFoodLog(entries: readonly (FoodItem & { meal: MealId })[]): void {
    storage.setItem(
      STORAGE_KEY.FOOD_LOG,
      JSON.stringify({
        date: THURSDAY_ISO,
        entries: entries.map(({ meal, ...food }, index) => ({
          ...food,
          meal,
          logId: `log-${index}`,
          loggedAt: THURSDAY.toISOString(),
        })),
      }),
    );
  }

  /** Puts meals on earlier days in the multi-day format, keyed by `YYYY-MM-DD`. */
  function storeFoodDays(days: Record<string, readonly FoodItem[]>): void {
    const stored = Object.fromEntries(
      Object.entries(days).map(([date, foods]) => [
        date,
        foods.map((food, index) => ({
          ...food,
          meal: 'frokost',
          logId: `log-${date}-${index}`,
          loggedAt: new Date(`${date}T12:00:00`).toISOString(),
        })),
      ]),
    );
    storage.setItem(STORAGE_KEY.FOOD_LOG, JSON.stringify({ days: stored }));
  }

  function storeWeighHistory(): void {
    weighIns = weighHistory(THURSDAY);
  }

  /** Today's weigh-in, as if the user had just weighed in. */
  function weighInToday(): void {
    flushTestWeighIns([weightLogDto(1, 74.2, 0, THURSDAY)]);
  }

  function setup(): HomeSummaryService {
    TestBed.configureTestingModule({
      providers: provideCoreTestEnvironment({ storage, now: THURSDAY }),
    });
    flushTestGoal();
    flushTestWeighIns(weighIns);
    TestBed.inject(UserProfileService).update(profilePatch);
    return TestBed.inject(HomeSummaryService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
    profilePatch = {};
    weighIns = [];
  });

  it('labels today and the week from the injected date', () => {
    const service = setup();

    expect(service.todayIndex()).toBe(THURSDAY_INDEX);
    expect(service.todayLabel()).toBe('Torsdag 24. sep');
    expect(service.weekProgressLabel()).toBe('Dag 4 af 7');
    expect(service.selectedDay()).toBe(THURSDAY_INDEX);
  });

  it('greets without a name until the profile has one', () => {
    const service = setup();

    expect(service.hasName()).toBe(false);

    TestBed.inject(UserProfileService).update({ username: 'Ida' });

    expect(service.hasName()).toBe(true);
  });

  it('leaves every ring without a logged day empty', () => {
    storeFoodLog([{ ...SKYR, meal: 'morgen' }]);
    const service = setup();
    const rings = service.weekRings();

    expect(rings.map((ring) => ring.label)).toEqual([
      'Man',
      'Tir',
      'Ons',
      'Tor',
      'Fre',
      'Lør',
      'Søn',
    ]);
    expect(rings[0]?.tone).toBe('none');
    expect(rings[0]?.dashOffset).toBeCloseTo(RING_CIRCUMFERENCE, 3);
    expect(rings[THURSDAY_INDEX]?.tone).toBe('accent');
    expect(rings[THURSDAY_INDEX]?.isToday).toBe(true);
    expect(rings[THURSDAY_INDEX]?.isSelected).toBe(true);
    expect(rings[6]?.tone).toBe('none');
    expect(rings[6]?.isFuture).toBe(true);
  });

  it('shows the kcal and macros of an earlier logged day', () => {
    // Tuesday and Wednesday before Thursday, 24 September 2026.
    storeFoodDays({ '2026-09-22': [SKYR, SALAT], '2026-09-23': [SALAT] });
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;

    const rings = service.weekRings();
    expect(rings[0]?.tone).toBe('none');
    expect(rings[1]?.tone).toBe('accent');
    expect(rings[1]?.dashOffset).toBeCloseTo(RING_CIRCUMFERENCE * (1 - 830 / target), 3);
    expect(rings[2]?.tone).toBe('accent');
    expect(rings[THURSDAY_INDEX]?.tone).toBe('none');

    service.selectDay(1);
    const summary = service.daySummary();
    expect(summary.kcalEatenText).toBe('830');
    expect(summary.progressTone).toBe('accent');
    expect(summary.macros[0]?.text.startsWith('73 / ')).toBe(true);

    expect(service.weekSummary().averageKcalText).toBe('640');
  });

  it('titles the selected day relative to today', () => {
    const service = setup();

    expect(service.daySummary().title).toBe('Torsdag · i dag');

    service.selectDay(2);
    expect(service.daySummary().title).toBe('Onsdag · i går');

    service.selectDay(1);
    expect(service.daySummary().title).toBe('Tirsdag');
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
    expect(summary.kcalTargetText).toBe(String(target));
    expect(summary.progress).toBeCloseTo(830 / target, 5);
    expect(summary.progressTone).toBe('accent');
    expect(summary.macros.map((macro) => macro.label)).toEqual(['Protein', 'Kulhydrat', 'Fedt']);
    expect(summary.macros[0]?.text.startsWith('73 / ')).toBe(true);
  });

  it('shows a dash for every day without data', () => {
    const service = setup();

    // No food log: even today has no data to show.
    for (const day of [1, 3, 6]) {
      service.selectDay(day);
      const summary = service.daySummary();

      expect(summary.progress).toBe(0);
      expect(summary.progressTone).toBe('muted');
      expect(summary.kcalEatenText).toBe('–');
      expect(summary.weightText).toBe('–');
      expect(summary.macros.every((macro) => macro.text.startsWith('– / '))).toBe(true);
    }
  });

  it('shows the weighing of an earlier day when there is one', () => {
    storeWeighHistory();
    const service = setup();

    // The most recent weigh-in is three days before Thursday, i.e. on Monday.
    service.selectDay(0);
    expect(service.daySummary().weightText).toBe('75,0');

    service.selectDay(1);
    expect(service.daySummary().weightText).toBe('–');
  });

  it('counts only the days that have data in the week card', () => {
    const service = setup();

    expect(service.weekSummary()).toMatchObject({
      progressLabel: 'Dag 4 af 7',
      hitText: '0',
      proteinHitText: '0',
      streakText: '0 dage',
      averageKcalText: '–',
      note: 'Ingen dage logget i denne uge endnu.',
    });
  });

  it('counts today once the calorie target is met', () => {
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;
    TestBed.inject(FoodLogService).add({ ...TEST_FOOD, kcal: target, protein: 500 }, 'aften');

    expect(service.weekSummary()).toMatchObject({
      hitText: '1',
      proteinHitText: '1',
      streakText: '1 dage',
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

    foodLog.add(TEST_FOOD, 'aften');
    foodLog.add(TEST_FOOD, 'snack');

    expect(service.todos()).toEqual([]);
    expect(service.nextTodo()).toBeNull();
    expect(service.todoCountLabel()).toBe('Kun én');
  });

  it('celebrates when the day reaches the calorie target', () => {
    const service = setup();
    const target = TestBed.inject(UserProfileService).targets().kcal;

    expect(service.goalReached()).toBe(false);

    TestBed.inject(FoodLogService).add({ ...TEST_FOOD, kcal: target }, 'aften');

    expect(service.goalReached()).toBe(true);
    expect(service.daySummary().progressTone).toBe('positive');
  });

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

  it('exposes the profile photo for the shared avatar', () => {
    const photo = {
      dataUrl: 'data:image/png;base64,xx',
      aspectRatio: 0.75,
      zoom: 1.4,
      x: 40,
      y: 60,
    };
    storeProfile({ photo });

    expect(setup().photo()).toEqual(photo);
  });

  it('has no photo when the profile has none', () => {
    expect(setup().photo()).toBeNull();
  });
});
