import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { newId } from '../utils/id';
import { BASE_COLLECTIONS, RECIPES } from '../constants/demo-data';
import { STORAGE_KEY } from '../constants/storage-key';
import { FoodCollection, FoodItem, Macros, NewCollectionInput, Recipe } from '../models/food';
import { StorageService } from './storage';

export type CollectionTotals = Macros & { count: number };

interface StoredCollections {
  userCollections: readonly FoodCollection[];
  /** Varer brugeren har lagt i de faste samlinger, pr. samlings-id. */
  baseItems: Readonly<Record<string, readonly FoodItem[]>>;
}

const EMPTY_STORED: StoredCollections = { userCollections: [], baseItems: {} };

/**
 * Retter og samlinger. De fire faste samlinger kommer fra `BASE_COLLECTIONS` og kan få varer
 * tilføjet; brugerens egne samlinger oprettes med `create()`. Kun brugerens ændringer gemmes,
 * så de faste definitioner kan opdateres i koden uden migrering.
 */
@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly storage = inject(StorageService);
  private readonly stored = signal<StoredCollections>(this.restore());

  readonly recipes: readonly Recipe[] = RECIPES;
  readonly collections: Signal<readonly FoodCollection[]> = computed(() => {
    const { userCollections, baseItems } = this.stored();
    const base = BASE_COLLECTIONS.map((collection) => ({
      ...collection,
      items: baseItems[collection.id] ?? collection.items,
    }));
    return [...base, ...userCollections];
  });
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

  /** Den faste samling, retten hører til. Ukendte retter lander i den første samling. */
  collectionForRecipe(recipeId: string): FoodCollection {
    const match = this.baseCollections().find((collection) =>
      collection.recipeIds.includes(recipeId),
    );
    return match ?? this.defaultCollection();
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
    this.set({
      ...this.stored(),
      userCollections: [...this.stored().userCollections, collection],
    });
    return collection;
  }

  addItem(collectionId: string, item: FoodItem): void {
    const target = this.collectionById(collectionId);
    if (!target) {
      return;
    }
    const current = this.stored();
    if (target.isBase) {
      this.set({
        ...current,
        baseItems: { ...current.baseItems, [collectionId]: [...target.items, item] },
      });
      return;
    }
    this.set({
      ...current,
      userCollections: current.userCollections.map((collection) =>
        collection.id === collectionId
          ? { ...collection, items: [...collection.items, item] }
          : collection,
      ),
    });
  }

  /** Finder en vare på tværs af alle samlingers `items`. */
  itemById(id: string): FoodItem | undefined {
    for (const collection of this.collections()) {
      const item = collection.items.find((candidate) => candidate.id === id);
      if (item) {
        return item;
      }
    }
    return undefined;
  }

  /** Summen af samlingens retter (som én portion hver) og løse varer. */
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
    return {
      userCollections: stored?.userCollections ?? EMPTY_STORED.userCollections,
      baseItems: stored?.baseItems ?? EMPTY_STORED.baseItems,
    };
  }

  private defaultCollection(): FoodCollection {
    const first = this.collections()[0];
    if (!first) {
      throw new Error('Der er ingen samlinger defineret.');
    }
    return first;
  }
}
