import { HttpTestingController } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, Routes, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE, QUERY_PARAM } from '../../../../core/constants/app-route';
import { FoodLogService } from '../../../../core/services/food-log/food-log';
import { BarcodeScanner } from '../../../../shared/components/barcode-scanner/barcode-scanner';
import { FOOD_ROUTES } from '../../food.routes';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { TEST_GOAL, flushTestGoal } from '../../../../core/testing/fixtures';
import {
  TEST_NOW,
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';

/**
 * The page renders in the real (jsdom) DOM, because the sheet and scanner read `document.activeElement`.
 * Only timers and "now" are overridden; storage is cleared per test, so `FoodLogService` seeds the demo log.
 */
const TEST_PROVIDERS: Provider[] = [...provideComponentTestEnvironment()];

const ROUTES: Routes = [{ path: APP_ROUTE.FOOD, children: FOOD_ROUTES }];

/** Fixed daily target from the API, so the macro percentages are the same on every run. */
const GOAL = {
  ...TEST_GOAL,
  targetDailyCalories: 2000,
  targetProtein: 150,
  targetCarbohydrates: 225,
  targetFat: 56,
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

describe('FoodPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** The app doesn't seed a food log itself – the tests put in the day's two meals. */
  beforeEach(() => {
    resetComponentTestStorage({
      [STORAGE_KEY.FOOD_LOG]: {
        date: '2026-09-21',
        entries: [
          {
            id: 'f-skyr',
            name: 'Skyr-bowl med bær',
            quantity: '250 g',
            kcal: 380,
            protein: 32,
            carbs: 38,
            fat: 9,
            logId: 'log-1',
            meal: 'morgen',
            loggedAt: TEST_NOW.toISOString(),
          },
          {
            id: 'f-salat',
            name: 'Kyllingesalat',
            quantity: '1 portion',
            kcal: 450,
            protein: 41,
            carbs: 18,
            fat: 22,
            logId: 'log-2',
            meal: 'frokost',
            loggedAt: TEST_NOW.toISOString(),
          },
        ],
      },
    });
  });

  async function setup(url: string = APP_PATH.FOOD) {
    TestBed.configureTestingModule({
      providers: [...TEST_PROVIDERS, provideRouter(ROUTES, withComponentInputBinding())],
    });
    flushTestGoal(GOAL);
    const harness = await RouterTestingHarness.create(url);
    const page = harness.routeNativeElement as HTMLElement;

    const settle = async (): Promise<void> => {
      await harness.fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await harness.fixture.whenStable();
    };

    await settle();
    return {
      harness,
      page,
      settle,
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

  it('removes a logged item from its meal group', async () => {
    const { page, settle, texts } = await setup();

    page.querySelector<HTMLButtonElement>('.food-meal-group__remove')?.click();
    await settle();

    expect(texts('.food-meal-group__name-text')).toEqual(['Kyllingesalat']);
    expect(TestBed.inject(FoodLogService).entries()).toHaveLength(1);
  });

  it('edits the macros of a logged custom food and updates both the food and the entry', async () => {
    const { page, settle } = await setup();
    const foodLog = TestBed.inject(FoodLogService);
    const bar = foodLog.addCustomFood({
      name: 'Egen bar',
      quantity: '50 g',
      kcal: 200,
      protein: 10,
      carbs: 20,
      fat: 8,
    });
    foodLog.add({ ...bar, quantity: '100 g', kcal: 400, protein: 20, carbs: 40, fat: 16 }, 'snack');
    await settle();

    page.querySelector<HTMLButtonElement>('[aria-label="Rediger Egen bar"]')?.click();
    await settle();
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement>('.food-picker__edit-macros input'),
    );
    expect(fields.map((field) => field.value)).toEqual(['200', '10', '20', '8']);
    fields[0]!.value = '250';
    fields[0]!.dispatchEvent(new Event('input'));
    await settle();
    document.querySelector<HTMLButtonElement>('.food-picker__confirm')?.click();
    await settle();

    expect(foodLog.customFoods()[0]).toMatchObject({ id: bar.id, quantity: '50 g', kcal: 250 });
    const entry = foodLog.entries().find((candidate) => candidate.id === bar.id);
    expect(entry).toMatchObject({ quantity: '100 g', kcal: 500, protein: 20 });
  });

  it('lets a custom food created with "Gem og log" be edited afterwards', async () => {
    const { page, settle } = await setup();
    const foodLog = TestBed.inject(FoodLogService);
    const typeInto = async (field: HTMLInputElement | undefined, value: string): Promise<void> => {
      field!.value = value;
      field!.dispatchEvent(new Event('input'));
      await settle();
    };

    page.querySelector<HTMLButtonElement>('.food-page__add')?.click();
    await settle();
    document.querySelector<HTMLButtonElement>('.food-picker__create')?.click();
    await settle();
    const newFoodFields = (): HTMLInputElement[] =>
      Array.from(document.querySelectorAll<HTMLInputElement>('.food-picker__fields input'));
    await typeInto(newFoodFields()[0], 'Egen bar');
    await typeInto(newFoodFields()[1], '50');
    await typeInto(newFoodFields()[2], '200');
    await typeInto(newFoodFields()[3], '10');
    document
      .querySelector<HTMLButtonElement>('.food-picker__actions button[type="submit"]')
      ?.click();
    await settle();

    const custom = foodLog.customFoods()[0];
    expect(custom).toMatchObject({ name: 'Egen bar', kcal: 200 });
    expect(foodLog.entries().find((entry) => entry.name === 'Egen bar')?.id).toBe(custom?.id);

    page.querySelector<HTMLButtonElement>('[aria-label="Rediger Egen bar"]')?.click();
    await settle();
    const macroFields = Array.from(
      document.querySelectorAll<HTMLInputElement>('.food-picker__edit-macros input'),
    );
    expect(macroFields.map((field) => field.value)).toEqual(['200', '10', '0', '0']);
    await typeInto(macroFields[0], '250');
    document.querySelector<HTMLButtonElement>('.food-picker__confirm')?.click();
    await settle();

    expect(foodLog.customFoods()).toHaveLength(1);
    expect(foodLog.customFoods()[0]).toMatchObject({ id: custom?.id, kcal: 250 });
    expect(foodLog.entries().find((entry) => entry.id === custom?.id)?.kcal).toBe(250);
  });

  it('still logs a scanned food whose name is taken and explains why it was not saved', async () => {
    const { harness, settle, text } = await setup();
    const foodLog = TestBed.inject(FoodLogService);
    const input = { quantity: '1 stk', kcal: 150, protein: 12, carbs: 0, fat: 0 };
    foodLog.addCustomFood({ ...input, name: 'Egen bar' });

    harness.fixture.debugElement
      .query(By.directive(BarcodeScanner))
      .triggerEventHandler('customSaved', {
        ...input,
        id: 'food-scan',
        name: ' egen BAR',
        isCustom: true,
      });
    await settle();

    expect(foodLog.customFoods()).toHaveLength(1);
    expect(foodLog.entries().some((entry) => entry.id === 'food-scan')).toBe(true);
    expect(text('.food-page__notice')).toContain('allerede en egen vare med navnet');
  });

  it('only lets the amount be edited for a food that is not the user own', async () => {
    const { page, settle } = await setup();

    page.querySelector<HTMLButtonElement>('[aria-label="Rediger Kyllingesalat"]')?.click();
    await settle();

    expect(document.querySelector('.food-picker__amount')).not.toBeNull();
    expect(document.querySelector('.food-picker__edit-macros')).toBeNull();
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

  it('opens the scanner from the round scan button', async () => {
    const { page, settle } = await setup();

    page.querySelector<HTMLButtonElement>('.food-page__scan')?.click();
    await settle();

    expect(page.querySelector('.barcode-scanner__overlay')).not.toBeNull();
  });
});
