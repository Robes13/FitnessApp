import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { FoodLogService } from '../food-log/food-log';
import { FoodSearchService } from './food-search';

describe('FoodSearchService', () => {
  let search: FoodSearchService;
  let foodLog: FoodLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    search = TestBed.inject(FoodSearchService);
    foodLog = TestBed.inject(FoodLogService);
  });

  function addCustom(name: string): void {
    foodLog.addCustomFood({ name, quantity: '1 stk', kcal: 200, protein: 20, carbs: 20, fat: 5 });
  }

  it('finds nothing until the user has created a food', async () => {
    await expect(firstValueFrom(search.search('havre'))).resolves.toEqual([]);
    await expect(firstValueFrom(search.search(''))).resolves.toEqual([]);
  });

  it('matches the user own foods case-insensitively', async () => {
    addCustom('Havregryn');

    const results = await firstValueFrom(search.search('HAVRE'));

    expect(results.map((food) => food.name)).toEqual(['Havregryn']);
    expect(results[0]?.isCustom).toBe(true);
  });

  it('returns newest first and at most six results for an empty query', async () => {
    for (let index = 1; index <= 7; index++) {
      addCustom(`Vare ${index}`);
    }

    const results = await firstValueFrom(search.search(''));

    expect(results).toHaveLength(6);
    expect(results[0]?.name).toBe('Vare 7');
  });

  it('returns an empty list when nothing matches', async () => {
    addCustom('Min bar');

    await expect(firstValueFrom(search.search('pizza'))).resolves.toEqual([]);
  });
});
