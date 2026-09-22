import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../utils/id';
import { normalizeName } from '../utils/name';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodCollection, FoodItem, Macros, NewCollectionInput, Recipe } from '../models/food';
import { StorageService } from './storage';

export type CollectionTotals = Macros & { count: number };

/** Thrown by `create()`/`update()` when another collection already has the name. */
export class DuplicateCollectionNameError extends Error {
  constructor(name: string) {
    super(`A collection named "${name}" already exists.`);
    this.name = 'DuplicateCollectionNameError';
  }
}

interface StoredCollections {
  collections: readonly FoodCollection[];
}

/**
 * Recipes and collections.
 *
 * The app has no recipes and no base collections yet – they need to come from the backend.
 * Until then, `recipes` is empty, and `collections` only contains the collections the user
 * has created themselves with `create()`. Only those can be edited (`update()`) and deleted
 * (`remove()`); base collections are read-only.
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

  /**
   * Whether another collection already has the name (trimmed, case-insensitive). `exceptId` is
   * the collection being edited, so it doesn't clash with its own name.
   */
  isNameTaken(name: string, exceptId?: string): boolean {
    const wanted = normalizeName(name);
    return this.collections().some(
      (collection) => collection.id !== exceptId && normalizeName(collection.name) === wanted,
    );
  }

  /** @throws DuplicateCollectionNameError if the name is taken – check `isNameTaken()` first. */
  create(input: NewCollectionInput): FoodCollection {
    this.assertNameFree(input.name);
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

  /**
   * Replaces name, icon, meal and items of a user collection. Returns the updated collection, or
   * `null` if the id is unknown or belongs to a base collection (those are read-only).
   * @throws DuplicateCollectionNameError if another collection has the name.
   */
  update(id: string, input: NewCollectionInput): FoodCollection | null {
    const current = this.userCollectionById(id);
    if (!current) {
      return null;
    }
    this.assertNameFree(input.name, id);
    const updated: FoodCollection = {
      ...current,
      name: input.name.trim(),
      icon: input.icon,
      meal: input.meal,
      items: [...input.items],
    };
    this.set({
      collections: this.stored().collections.map((collection) =>
        collection.id === id ? updated : collection,
      ),
    });
    return updated;
  }

  /** Deletes a user collection. Returns `false` for an unknown id or a base collection. */
  remove(id: string): boolean {
    if (!this.userCollectionById(id)) {
      return false;
    }
    this.set({
      collections: this.stored().collections.filter((collection) => collection.id !== id),
    });
    return true;
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

  private userCollectionById(id: string): FoodCollection | undefined {
    const collection = this.collectionById(id);
    return collection && !collection.isBase ? collection : undefined;
  }

  private assertNameFree(name: string, exceptId?: string): void {
    if (this.isNameTaken(name, exceptId)) {
      throw new DuplicateCollectionNameError(name.trim());
    }
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
