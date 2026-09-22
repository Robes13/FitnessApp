import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../utils/id';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodCollection, FoodItem, Macros, NewCollectionInput, Recipe } from '../models/food';
import { StorageService } from './storage';

export type CollectionTotals = Macros & { count: number };

interface StoredCollections {
  collections: readonly FoodCollection[];
}

/**
 * Recipes and collections.
 *
 * The app has no recipes and no base collections yet – they need to come from the backend.
 * Until then, `recipes` is empty, and `collections` only contains the collections the user
 * has created themselves with `create()`.
 */
@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly storage = inject(StorageService);
  private readonly stored = signal<StoredCollections>(this.restore());

  /** Recipes from the backend. Empty until there's an API to fetch them from. */
  readonly recipes: readonly Recipe[] = [];

  readonly collections: Signal<readonly FoodCollection[]> = computed(
    () => this.stored().collections,
  );
  /** Collections defined by the system. Empty until the backend supplies them. */
  readonly baseCollections: Signal<readonly FoodCollection[]> = computed(() =>
    this.collections().filter((collection) => collection.isBase),
  );
  readonly userCollections: Signal<readonly FoodCollection[]> = computed(() =>
    this.collections().filter((collection) => !collection.isBase),
  );

  recipeById(id: string): Recipe | undefined {
    return this.recipes.find((recipe) => recipe.id === id);
  }

  collectionById(id: string): FoodCollection | undefined {
    return this.collections().find((collection) => collection.id === id);
  }

  /** The base collection the recipe belongs to, or `null` if no collection references it. */
  collectionForRecipe(recipeId: string): FoodCollection | null {
    return (
      this.baseCollections().find((collection) => collection.recipeIds.includes(recipeId)) ?? null
    );
  }

  create(input: NewCollectionInput): FoodCollection {
    const collection: FoodCollection = {
      id: newId('c'),
      name: input.name.trim(),
      icon: input.icon,
      meal: input.meal,
      isBase: false,
      recipeIds: [],
      items: [...input.items],
    };
    this.set({ collections: [...this.stored().collections, collection] });
    return collection;
  }

  addItem(collectionId: string, item: FoodItem): void {
    this.set({
      collections: this.stored().collections.map((collection) =>
        collection.id === collectionId
          ? { ...collection, items: [...collection.items, item] }
          : collection,
      ),
    });
  }

  /** Finds an item across all collections' `items`. */
  itemById(id: string): FoodItem | undefined {
    for (const collection of this.collections()) {
      const item = collection.items.find((candidate) => candidate.id === id);
      if (item) {
        return item;
      }
    }
    return undefined;
  }

  /** The sum of the collection's recipes (as one portion each) and loose items. */
  collectionTotals(collection: FoodCollection): CollectionTotals {
    const recipes = collection.recipeIds
      .map((id) => this.recipeById(id))
      .filter((recipe): recipe is Recipe => recipe !== undefined);
    const parts: readonly Macros[] = [...recipes, ...collection.items];
    return parts.reduce<CollectionTotals>(
      (sum, part) => ({
        kcal: sum.kcal + part.kcal,
        protein: sum.protein + part.protein,
        carbs: sum.carbs + part.carbs,
        fat: sum.fat + part.fat,
        count: sum.count + 1,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 },
    );
  }

  private set(stored: StoredCollections): void {
    this.stored.set(stored);
    this.storage.write(STORAGE_KEY.COLLECTIONS, stored);
  }

  private restore(): StoredCollections {
    const stored = this.storage.read<Partial<StoredCollections>>(STORAGE_KEY.COLLECTIONS);
    return { collections: stored?.collections ?? [] };
  }
}
