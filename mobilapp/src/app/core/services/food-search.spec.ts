import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { FoodLogService } from './food-log';
import { FoodSearchService } from './food-search';

describe('FoodSearchService', () => {
  let search: FoodSearchService;
  let foodLog: FoodLogService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    search = TestBed.inject(FoodSearchService);
    foodLog = TestBed.inject(FoodLogService);
  });

  it('matches names case-insensitively', async () => {
    const results = await firstValueFrom(search.search('HAVRE'));

    expect(results.map((food) => food.name)).toEqual(['Havregryn']);
  });

  it('returns at most six results for an empty query', async () => {
    const results = await firstValueFrom(search.search(''));

    expect(results).toHaveLength(6);
    expect(results[0]?.name).toBe('Havregryn');
  });

  it('lists custom foods first and flags them', async () => {
    foodLog.addCustomFood({
      name: 'Min bar',
      quantity: '1 stk',
      kcal: 200,
      protein: 20,
      carbs: 20,
      fat: 5,
    });

    const results = await firstValueFrom(search.search('bar'));

    expect(results.map((food) => food.name)).toEqual(['Min bar', 'Proteinbar']);
    expect(results[0]?.isCustom).toBe(true);
    expect(results[1]?.isCustom).toBeUndefined();
  });

  it('returns an empty list when nothing matches', async () => {
    await expect(firstValueFrom(search.search('pizza'))).resolves.toEqual([]);
  });
});
