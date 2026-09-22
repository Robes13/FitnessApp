import { TestBed } from '@angular/core/testing';
import { APP_PATH, QUERY_PARAM } from '../../../core/constants/app-route';
import { DEMO_PROFILE_DEFAULTS } from '../../../core/constants/demo-data';
import { STORAGE_KEY } from '../../../core/constants/storage-key';
import { UserProfile } from '../../../core/models/profile';
import { FoodLogService } from '../../../core/services/food-log';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import { FakeStorage, createFakeStorage } from '../../../core/testing/fake-document';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { HomeSummaryService } from './home-summary';

/** Torsdag 24. september 2026 – midt i ugen, så både fortid, i dag og fremtid er i spil. */
const THURSDAY = new Date(2026, 8, 24, 10, 30);
const THURSDAY_INDEX = 3;
const RING_CIRCUMFERENCE = 100.5;

describe('HomeSummaryService', () => {
  let storage: FakeStorage;

  function storeProfile(patch: Partial<UserProfile>): void {
    storage.setItem(STORAGE_KEY.PROFILE, JSON.stringify({ ...DEMO_PROFILE_DEFAULTS, ...patch }));
  }

  function setup(): HomeSummaryService {
    TestBed.configureTestingModule({
      providers: provideCoreTestEnvironment({ storage, now: THURSDAY }),
    });
    return TestBed.inject(HomeSummaryService);
  }

  beforeEach(() => {
    storage = createFakeStorage();
  });

  it('labels today and the week from the injected date', () => {
    const service = setup();

    expect(service.todayIndex()).toBe(THURSDAY_INDEX);
    expect(service.todayLabel()).toBe('Torsdag 24. sep');
    expect(service.weekProgressLabel()).toBe('Dag 4 af 7');
    expect(service.selectedDay()).toBe(THURSDAY_INDEX);
  });

  it('builds seven rings with demo history behind today and empty rings ahead', () => {
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
    expect(rings[0]?.tone).toBe('positive');
    expect(rings[0]?.dashOffset).toBeCloseTo(0, 3);
    expect(rings[2]?.tone).toBe('accent');
    expect(rings[2]?.dashOffset).toBeCloseTo(RING_CIRCUMFERENCE * 0.14, 3);
    expect(rings[THURSDAY_INDEX]?.isToday).toBe(true);
    expect(rings[THURSDAY_INDEX]?.isSelected).toBe(true);
    expect(rings[6]?.tone).toBe('none');
    expect(rings[6]?.isFuture).toBe(true);
    expect(rings[6]?.dashOffset).toBeCloseTo(RING_CIRCUMFERENCE, 3);
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
    const service = setup();
    const target = TestBed.inject(UserProfileService).kcalTarget();
    const summary = service.daySummary();

    // De to demo-varer: 380 + 450 kcal og 32 + 41 g protein.
    expect(summary.kcalEatenText).toBe('830');
    expect(summary.kcalTargetText).toBe(String(target));
    expect(summary.progress).toBeCloseTo(830 / target, 5);
    expect(summary.progressTone).toBe('accent');
    expect(summary.macros.map((macro) => macro.label)).toEqual(['Protein', 'Kulhydrat', 'Fedt']);
    expect(summary.macros[0]?.text.startsWith('73 / ')).toBe(true);
  });

  it('empties the card for a day that has not come yet', () => {
    const service = setup();

    service.selectDay(6);
    const summary = service.daySummary();

    expect(summary.progress).toBe(0);
    expect(summary.progressTone).toBe('muted');
    expect(summary.kcalEatenText).toBe('–');
    expect(summary.weightText).toBe('–');
    expect(summary.macros.every((macro) => macro.text.startsWith('– / '))).toBe(true);
  });

  it('sums the week from the demo history and the real day', () => {
    const service = setup();
    const summary = service.weekSummary();

    expect(summary.progressLabel).toBe('Dag 4 af 7');
    expect(summary.hitText).toBe('2');
    expect(summary.proteinHitText).toBe('2');
    expect(summary.streakText).toBe('3 dage');
    expect(summary.note).toBe('Solid uge. Protein er det, der løfter resten.');
  });

  it('lists weighing and the missing meals as next steps', () => {
    const service = setup();

    expect(service.todos().map((todo) => todo.title)).toEqual([
      'Husk at veje dig i dag',
      'Log din aftensmad',
      'Log din snacks',
    ]);
    expect(service.nextTodo()).toEqual({
      title: 'Husk at veje dig i dag',
      subtitle: 'Tryk her for at registrere din vægt',
      path: APP_PATH.WEIGHT,
      queryParams: null,
    });
    expect(service.todoCountLabel()).toBe('1 / 3');
  });

  it('sends a meal step to Mad with the meal as a query parameter', () => {
    const service = setup();
    TestBed.inject(WeightLogService).add(74.2);

    const todo = service.nextTodo();

    expect(todo?.title).toBe('Log din aftensmad');
    expect(todo?.path).toBe(APP_PATH.FOOD);
    expect(todo?.queryParams).toEqual({ [QUERY_PARAM.ADD_MEAL]: 'aften' });
    expect(service.todoCountLabel()).toBe('1 / 2');
  });

  it('has no next step when everything is logged and weighed', () => {
    const service = setup();
    const foodLog = TestBed.inject(FoodLogService);
    TestBed.inject(WeightLogService).add(74.2);
    const bar = {
      id: 'x',
      name: 'Proteinbar',
      quantity: '55 g',
      kcal: 210,
      protein: 20,
      carbs: 22,
      fat: 7,
    };
    foodLog.add(bar, 'aften');
    foodLog.add(bar, 'snack');

    expect(service.todos()).toEqual([]);
    expect(service.nextTodo()).toBeNull();
    expect(service.todoCountLabel()).toBe('Kun én');
  });

  it('celebrates when the day reaches the calorie target', () => {
    const service = setup();
    const target = TestBed.inject(UserProfileService).kcalTarget();

    expect(service.goalReached()).toBe(false);

    TestBed.inject(FoodLogService).add(
      {
        id: 'y',
        name: 'Kæmpemåltid',
        quantity: '1 portion',
        kcal: target,
        protein: 0,
        carbs: 0,
        fat: 0,
      },
      'aften',
    );

    expect(service.goalReached()).toBe(true);
    expect(service.daySummary().progressTone).toBe('positive');
  });

  it('describes the way to the goal weight', () => {
    storeProfile({ goal: 'tabe', weightKg: 75, goalWeightKg: 70 });
    const service = setup();

    const goal = service.goalSummary();

    expect(service.showGoalCard()).toBe(true);
    expect(goal.toGoalText).toBe('5,0 kg');
    expect(goal.goalWeightText).toBe('70');
    expect(goal.coach).toBe('Med dit tempo på 0,5 kg/uge er du der om ca. 10 uger.');
    // Startvægten er den ældste demo-vejning, 76,1 kg.
    expect(goal.progress).toBeCloseTo(1 - 5 / 6.1, 5);
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
