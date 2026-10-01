import { HttpTestingController } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE, QUERY_PARAM } from '../../../../core/constants/app-route';
import { FoodItem } from '../../../../core/models/food';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import {
  TEST_GOAL,
  flushTestFoodLog,
  flushTestGoal,
  testFood,
  testFoodLog,
} from '../../../../core/testing/fixtures';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { FOOD_ROUTES } from '../../food.routes';

/**
 * The page renders in the real (jsdom) DOM, because the sheet and scanner read `document.activeElement`.
 * Only "now" is overridden; the food log and the goal come from `HttpTestingController`.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

const ROUTES: Routes = [{ path: APP_ROUTE.FOOD, children: FOOD_ROUTES }];

const FOOD_LOGS_URL = '/api/v1/me/food-logs';

/** Fixed daily target from the API, so the macro percentages are the same on every run. */
const GOAL = {
  ...TEST_GOAL,
  targetDailyCalories: 2000,
  targetProtein: 150,
  targetCarbohydrates: 225,
  targetFat: 56,
};

const SKYR_BOWL: FoodItem = {
  id: '1',
  name: 'Skyr-bowl med bær',
  quantity: '250 g',
  kcal: 380,
  protein: 32,
  carbs: 38,
  fat: 9,
};
const SALAT: FoodItem = {
  id: '2',
  name: 'Kyllingesalat',
  quantity: '1 portion',
  kcal: 450,
  protein: 41,
  carbs: 18,
  fat: 22,
};
/** In the catalogue with its barcode – a scan finds it there before Open Food Facts. */
const HAVREGRYN_BARCODE = '5701234567890';
const HAVREGRYN = testFood({
  foodId: 3,
  name: 'Havregryn',
  barcode: HAVREGRYN_BARCODE,
  caloriesPer100: 370,
  proteinPer100: 13,
});
/** A barcode Open Food Facts doesn't know. */
const UNKNOWN_BARCODE = '5799999999991';

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('FoodPage', () => {
  /** The day's two meals as the API returns them. */
  const breakfast = testFoodLog(SKYR_BOWL, 'morgen', undefined, 1);
  const lunch = testFoodLog(SALAT, 'frokost', undefined, 2);
  let http: HttpTestingController;

  beforeEach(() => resetComponentTestStorage());

  afterEach(() => http.verify());

  /** `load: false` leaves the food log's first load to the test. */
  async function setup(url: string = APP_PATH.FOOD, load = true) {
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, provideRouter(ROUTES, withComponentInputBinding())],
    });
    http = TestBed.inject(HttpTestingController);
    flushTestGoal(GOAL);
    if (load) {
      flushTestFoodLog([HAVREGRYN], [breakfast, lunch]);
    }
    const harness = await RouterTestingHarness.create(url);
    const page = harness.routeNativeElement as HTMLElement;

    const settle = async (): Promise<void> => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };
    const click = async (element: Element | null | undefined): Promise<void> => {
      (element as HTMLElement | null | undefined)?.click();
      await settle();
    };
    const buttonByText = (label: string): HTMLButtonElement | undefined =>
      Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
        (button) => normalize(button.textContent) === label,
      );
    const typeInto = async (field: HTMLInputElement | null | undefined, value: string) => {
      if (!field) {
        throw new Error('Feltet findes ikke.');
      }
      field.value = value;
      field.dispatchEvent(new Event('input'));
      await settle();
    };
    /** Opens the scanner from the round button and looks `barcode` up (the browser has no camera). */
    const lookUp = async (barcode: string): Promise<void> => {
      await click(page.querySelector('.food-page__scan'));
      await typeInto(
        page.querySelector<HTMLInputElement>('input[aria-label="Stregkode"]'),
        barcode,
      );
      await click(buttonByText('Slå op'));
    };

    await settle();
    return {
      harness,
      page,
      settle,
      click,
      buttonByText,
      typeInto,
      lookUp,
      text: (selector: string) => normalize(page.querySelector(selector)?.textContent),
      texts: (selector: string) =>
        Array.from(page.querySelectorAll(selector)).map((node) => normalize(node.textContent)),
    };
  }

  it('shows the day, the kcal ring and the four meal groups', async () => {
    const { page, text, texts } = await setup();

    expect(text('.food-page__title')).toBe('Dagens mad');
    expect(text('.food-page__date')).toBe('Mandag 21. sep');
    expect(text('.food-page__summary-label')).toBe('Tilbage i dag');
    expect(texts('.food-meal-group__label')).toEqual([
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(text('.food-page__summary-value')).toBe('1170kcal');
    expect(texts('.food-page__macro-head span')).toEqual([
      'Protein',
      '49%',
      'Kulhydrat',
      '25%',
      'Fedt',
      '55%',
    ]);
    expect(texts('.food-page__macro-text')).toEqual(['73 / 150 g', '56 / 225 g', '31 / 56 g']);
    expect(texts('.food-meal-group__name-text')).toEqual(['Skyr-bowl med bær', 'Kyllingesalat']);
    expect(page.querySelector('.food-page__clearance')).not.toBeNull();
  });

  it('shows a spinner during the first load', async () => {
    const { page, settle } = await setup(APP_PATH.FOOD, false);

    TestBed.inject(FoodLogService).load().subscribe();
    await settle();
    expect(page.querySelector('.food-page__status app-ui-spinner')).not.toBeNull();
    expect(page.querySelector('.food-page__summary')).toBeNull();

    http
      .expectOne('/api/v1/foods?limit=100')
      .flush({ items: [], nextCursor: null, hasMore: false });
    http
      .expectOne((request) => request.url === FOOD_LOGS_URL)
      .flush({ items: [breakfast], nextCursor: null, hasMore: false });
    await settle();

    expect(page.querySelector('app-ui-spinner')).toBeNull();
    expect(page.querySelector('.food-page__summary')).not.toBeNull();
  });

  it('shows the load error and retries only the failed food log', async () => {
    const { page, settle, click, buttonByText, texts } = await setup(APP_PATH.FOOD, false);

    TestBed.inject(FoodLogService).load().subscribe();
    http.expectOne('/api/v1/foods?limit=100').flush(null, { status: 500, statusText: 'Error' });
    http.expectOne((request) => request.url === FOOD_LOGS_URL);
    await settle();

    expect(normalize(page.querySelector('.food-page__status')?.textContent)).toContain(
      'Vi kunne ikke hente din mad og dit kaloriemål.',
    );
    await click(buttonByText('Prøv igen'));
    http
      .expectOne('/api/v1/foods?limit=100')
      .flush({ items: [], nextCursor: null, hasMore: false });
    http
      .expectOne((request) => request.url === FOOD_LOGS_URL)
      .flush({ items: [lunch], nextCursor: null, hasMore: false });
    await settle();

    expect(texts('.food-meal-group__name-text')).toEqual(['Kyllingesalat']);
  });

  it('also shows the error state when the profile (the kcal goal) failed to load', async () => {
    const { page, settle, click, buttonByText } = await setup();

    TestBed.inject(UserProfileService).load().subscribe();
    const [first] = http.match((request) => request.url.startsWith('/api/v1/me'));
    first?.flush(null, { status: 500, statusText: 'Error' });
    await settle();

    expect(page.querySelector('.food-page__status app-ui-empty-state')).not.toBeNull();
    expect(page.querySelector('.food-page__meals')).toBeNull();

    await click(buttonByText('Prøv igen'));
    const retried = http.match(() => true);
    expect(retried.map((request) => request.request.url)).toContain('/api/v1/me/profile');
    expect(retried.some((request) => request.request.url.startsWith('/api/v1/foods'))).toBe(false);
  });

  it('removes a logged item only after the confirmation and the API', async () => {
    const { page, click, buttonByText, text, texts, settle } = await setup();

    await click(page.querySelector('.food-meal-group__remove'));
    expect(text('app-ui-confirm-sheet .ui-sheet__title')).toBe('Fjern vare?');
    expect(text('.ui-confirm-sheet__body')).toBe(
      '«Skyr-bowl med bær» bliver fjernet fra dagens log.',
    );
    await click(buttonByText('Annuller'));
    expect(texts('.food-meal-group__name-text')).toHaveLength(2);

    await click(page.querySelector('.food-meal-group__remove'));
    await click(buttonByText('Ja, fjern varen'));
    const request = http.expectOne({
      method: 'DELETE',
      url: `${FOOD_LOGS_URL}/${breakfast.foodLogId}`,
    });
    expect(buttonByText('Ja, fjern varen')?.getAttribute('aria-busy')).toBe('true');
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(texts('.food-meal-group__name-text')).toEqual(['Kyllingesalat']);
    expect(page.querySelector('.ui-confirm-sheet__body')).toBeNull();
  });

  it('says an item that is already gone no longer exists', async () => {
    const { page, click, buttonByText, text, texts, settle } = await setup();

    await click(page.querySelector('.food-meal-group__remove'));
    await click(buttonByText('Ja, fjern varen'));
    http
      .expectOne({ method: 'DELETE', url: `${FOOD_LOGS_URL}/${breakfast.foodLogId}` })
      .flush(null, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(text('.food-page__notice')).toBe('Varen findes ikke længere.');
    expect(texts('.food-meal-group__name-text')).toEqual(['Kyllingesalat']);
  });

  it('logs a picked food once and closes the sheet when the API has answered', async () => {
    const { page, click, text, texts, settle } = await setup();

    await click(page.querySelector('.food-page__add'));
    await click(page.querySelector('.food-picker__result'));
    await click(page.querySelector('.food-picker__confirm'));
    const request = http.expectOne({ method: 'POST', url: FOOD_LOGS_URL });
    expect(request.request.body).toMatchObject({ foodId: 3, quantity: 100, unit: 'Gram' });
    expect(page.querySelector('.food-picker__confirm')?.getAttribute('aria-busy')).toBe('true');
    await click(page.querySelector('.food-picker__confirm'));

    request.flush({
      ...testFoodLog({ ...SKYR_BOWL, name: 'Havregryn', kcal: 370 }, 'morgen'),
      foodId: 3,
    });
    await settle();

    expect(page.querySelector('.food-picker__confirm')).toBeNull();
    expect(texts('.food-meal-group__name-text')).toContain('Havregryn');
    expect(text('.food-page__summary-value')).toBe('800kcal');
  });

  it('keeps the sheet open and says why when saving fails', async () => {
    const { page, click, text, settle } = await setup();

    await click(page.querySelector('.food-page__add'));
    await click(page.querySelector('.food-picker__result'));
    await click(page.querySelector('.food-picker__confirm'));
    http
      .expectOne({ method: 'POST', url: FOOD_LOGS_URL })
      .flush(
        { title: 'Validation failed', status: 400 },
        { status: 400, statusText: 'Bad Request' },
      );
    await settle();

    expect(text('.food-add-sheet__error')).toBe('Varen blev ikke gemt. Prøv igen.');
    expect(page.querySelector('.food-picker__confirm')).not.toBeNull();

    await click(page.querySelector('.food-picker__confirm'));
    http
      .expectOne({ method: 'POST', url: FOOD_LOGS_URL })
      .flush(null, { status: 503, statusText: 'Unavailable' });
    await settle();

    expect(text('.food-add-sheet__error')).toBe('Serveren svarer ikke lige nu. Prøv igen om lidt.');
  });

  it('edits only the amount of a logged item', async () => {
    const { page, click, settle } = await setup();

    await click(page.querySelector('[aria-label="Rediger Kyllingesalat"]'));
    expect(page.querySelectorAll('.food-picker__step--portion input')).toHaveLength(1);
    await click(page.querySelectorAll('.food-picker__stepper')[1]);
    await click(page.querySelector('.food-picker__confirm'));

    const request = http.expectOne({ method: 'PATCH', url: `${FOOD_LOGS_URL}/${lunch.foodLogId}` });
    expect(request.request.body).toEqual({ quantity: 2, unit: 'Serving' });
    request.flush({ ...lunch, quantity: 2, caloriesConsumed: 900 });
    await settle();

    const entry = TestBed.inject(FoodLogService)
      .entries()
      .find((candidate) => candidate.logId === String(lunch.foodLogId));
    expect(entry).toMatchObject({ quantity: '2 portion', kcal: 900, meal: 'frokost' });
  });

  it('opens the add sheet on the meal from the query param and clears it again', async () => {
    const { page } = await setup(`${APP_PATH.FOOD}?${QUERY_PARAM.ADD_MEAL}=frokost`);

    expect(normalize(page.querySelector('.ui-sheet__title')?.textContent)).toBe('Tilføj frokost');
    expect(TestBed.inject(Router).url).toBe(APP_PATH.FOOD);
  });

  it('opens the add sheet on the meal behind "+ Tilføj til aftensmad"', async () => {
    const { page, settle } = await setup();

    const addLinks = Array.from(page.querySelectorAll<HTMLButtonElement>('.food-meal-group__add'));
    addLinks[2]?.click();
    await settle();

    expect(normalize(page.querySelector('.ui-sheet__title')?.textContent)).toBe('Tilføj aftensmad');
  });

  it('logs a scanned item under the meal picked on the scanner, not a hidden one', async () => {
    const { page, click, buttonByText, lookUp, settle } = await setup();

    await lookUp(HAVREGRYN_BARCODE);
    const selected = page.querySelector('.barcode-scanner__meal.ui-chip--selected');
    expect(normalize(selected?.textContent)).toBe('Morgenmad');
    await click(buttonByText('Frokost'));
    await click(buttonByText('Tilføj'));

    const request = http.expectOne({ method: 'POST', url: FOOD_LOGS_URL });
    expect(request.request.body).toMatchObject({
      foodId: 3,
      quantity: 100,
      unit: 'Gram',
      mealType: 'Lunch',
    });
    request.flush({
      ...testFoodLog({ ...SKYR_BOWL, name: 'Havregryn', quantity: '100 g' }, 'frokost'),
      foodId: 3,
    });
    await settle();

    const lunchGroup = page.querySelectorAll('app-food-meal-group')[1];
    expect(normalize(lunchGroup?.textContent)).toContain('Havregryn');
  });

  it('creates a barcode Open Food Facts does not know as the user own food with it', async () => {
    const { page, click, buttonByText, typeInto, lookUp, settle, texts } = await setup();

    await lookUp(UNKNOWN_BARCODE);
    http
      .expectOne((request) => request.url.endsWith(`/product/${UNKNOWN_BARCODE}.json`))
      .flush({ status: 0 }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(normalize(page.querySelector('.barcode-scanner__hint')?.textContent)).toBe(
      'Varen blev ikke fundet.',
    );
    await click(buttonByText('Opret varen selv'));

    expect(page.querySelector('.barcode-scanner__overlay')).toBeNull();
    const fields = () =>
      Array.from(page.querySelectorAll<HTMLInputElement>('.food-picker__fields input'));
    await typeInto(fields()[0], 'Ukendt bar');
    await typeInto(fields()[1], '40');
    await typeInto(fields()[2], '180');
    await click(buttonByText('Gem og log under morgenmad'));

    const create = http.expectOne({ method: 'POST', url: '/api/v1/foods' });
    expect(create.request.body).toMatchObject({ name: 'Ukendt bar', barcode: UNKNOWN_BARCODE });
    create.flush(testFood({ foodId: 9, name: 'Ukendt bar', barcode: UNKNOWN_BARCODE }));
    const log = http.expectOne({ method: 'POST', url: FOOD_LOGS_URL });
    expect(log.request.body).toMatchObject({ foodId: 9, quantity: 40, mealType: 'Breakfast' });
    log.flush({ ...testFoodLog({ ...SKYR_BOWL, name: 'Ukendt bar' }, 'morgen'), foodId: 9 });
    await settle();

    // The next scan finds it in the catalogue – no Open Food Facts request.
    await lookUp(UNKNOWN_BARCODE);
    expect(page.querySelector('.barcode-scanner__result')).not.toBeNull();
    expect(texts('.ui-sheet__title')).toContain('Ukendt bar');
  });

  it('opens the scanner from the round scan button', async () => {
    const { page, settle } = await setup();

    page.querySelector<HTMLButtonElement>('.food-page__scan')?.click();
    await settle();

    expect(page.querySelector('.barcode-scanner__overlay')).not.toBeNull();
  });
});
