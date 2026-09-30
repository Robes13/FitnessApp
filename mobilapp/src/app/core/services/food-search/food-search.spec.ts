import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FoodDto } from '../../models/food-api';
import { flushTestFoodLog, testFood } from '../../testing/fixtures';
import { provideCoreTestEnvironment } from '../../testing/test-providers';
import { FoodSearchService } from './food-search';

describe('FoodSearchService', () => {
  let search: FoodSearchService;

  /** The catalogue comes newest first from the API. */
  function catalogue(...names: string[]): FoodDto[] {
    return names.map((name, index) => testFood({ foodId: names.length - index, name }));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideCoreTestEnvironment() });
    search = TestBed.inject(FoodSearchService);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('finds nothing until the user has created a food', async () => {
    await expect(firstValueFrom(search.search('havre'))).resolves.toEqual([]);
    await expect(firstValueFrom(search.search(''))).resolves.toEqual([]);
  });

  it('matches the user own foods case-insensitively', async () => {
    flushTestFoodLog(catalogue('Havregryn', 'Skyr'));

    const results = await firstValueFrom(search.search('HAVRE'));

    expect(results.map((food) => food.name)).toEqual(['Havregryn']);
    expect(results[0]?.isCustom).toBe(true);
  });

  it('returns newest first and at most six results for an empty query', async () => {
    flushTestFoodLog(
      catalogue('Vare 7', 'Vare 6', 'Vare 5', 'Vare 4', 'Vare 3', 'Vare 2', 'Vare 1'),
    );

    const results = await firstValueFrom(search.search(''));

    expect(results).toHaveLength(6);
    expect(results[0]?.name).toBe('Vare 7');
  });

  it('returns an empty list when nothing matches', async () => {
    flushTestFoodLog(catalogue('Min bar'));

    await expect(firstValueFrom(search.search('pizza'))).resolves.toEqual([]);
  });
});
