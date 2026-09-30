import { Injectable, inject } from '@angular/core';
import { CollectionIconName } from '../../../core/constants/collection-icons';
import { FoodCollection, FoodItem, Ingredient, Macros, Recipe } from '../../../core/models/food';
import { MEAL_TONES } from '../../../core/constants/meals';
import { MealId, MealTone } from '../../../core/models/meal';
import { CollectionsService } from '../../../core/services/collections/collections';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { formatGrams } from '../../../core/utils/date-format';

/** The prefix in front of a collection's id when the whole collection opens as one "bundle". */
export const BUNDLE_ID_PREFIX = 'col:';

/** The icon on a dish that doesn't belong to any collection. */
const RECIPE_FALLBACK_ICON: CollectionIconName = 'utensils';

const EMPTY_SUBTITLE_KEY = 'collections.view.emptySubtitle';
const ALL_CHIP_LABEL_KEY = 'collections.view.allChip';

/** A row in the list on the collections screen: a bundle, a standalone food or a dish. */
export interface CollectionEntry {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The small uppercase line above the title, e.g. `Morgenmad · 5 min`. */
  readonly meta: string;
  /** `'420 kcal · 31,5 g protein'` */
  readonly macrosText: string;
  readonly icon: CollectionIconName;
  readonly tone: MealTone;
}

/** Filter chip above the list. `id` is `null` on "All". */
export interface CollectionFilterChip {
  readonly id: string | null;
  readonly label: string;
}

/** Everything the recipe screen needs – regardless of whether the source is a dish, a bundle or a food. */
export interface RecipeDetail {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: CollectionIconName;
  readonly tone: MealTone;
  /** The meal that "Log as eaten under" starts on. */
  readonly meal: MealId;
  readonly macros: Macros;
  readonly contents: readonly Ingredient[];
}

function countLabel(t: Translate, count: number): string {
  return count === 1
    ? t('collections.view.itemCountOne')
    : t('collections.view.itemCountMany', { count });
}

function itemNames(t: Translate, items: readonly FoodItem[]): string {
  return items.length > 0 ? items.map((item) => item.name).join(', ') : t(EMPTY_SUBTITLE_KEY);
}

function macrosText(t: Translate, { kcal, protein }: Macros): string {
  return t('collections.view.macros', { kcal: Math.round(kcal), protein: formatGrams(protein) });
}

function sumMacros(parts: readonly Macros[]): Macros {
  return parts.reduce<Macros>(
    (sum, part) => ({
      kcal: sum.kcal + part.kcal,
      protein: sum.protein + part.protein,
      carbs: sum.carbs + part.carbs,
      fat: sum.fat + part.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/**
 * Builds the collections screen's rows and the recipe screen's data from `CollectionsService`.
 *
 * The design mixes three kinds of rows into one list (`recipes` in `logic.js`): the user's own
 * collections shown as a single bundle, standalone foods placed in the fixed collections, and the
 * dishes themselves. The ordering and filtering is a direct translation of `colsInView` /
 * `userCols` / `baseCols` from there.
 *
 * The color is tied to the meal instead of the design's collection id (`c1`–`c4`), because the
 * model in `core` has a real `meal` field. The result is the same: breakfast orange, lunch green,
 * dinner blue, snacks red – also for the user's own collections.
 */
@Injectable({ providedIn: 'root' })
export class CollectionsViewService {
  private readonly collections = inject(CollectionsService);
  private readonly t = injectTranslate();

  /** "All" followed by the fixed collections. None exist yet, so the list is short. */
  chips(): readonly CollectionFilterChip[] {
    return [
      { id: null, label: this.t(ALL_CHIP_LABEL_KEY) },
      ...this.collections
        .baseCollections()
        .map((collection) => ({ id: collection.id, label: collection.name })),
    ];
  }

  /**
   * The rows for the selected filter. `null` shows everything; otherwise the selected fixed
   * collection is shown, along with its standalone foods, its dishes and the user's own
   * collections with the same meal.
   */
  entriesFor(selectedId: string | null): readonly CollectionEntry[] {
    const all = this.collections.collections();
    const selected = selectedId === null ? undefined : this.collections.collectionById(selectedId);
    const inView = selected
      ? [selected, ...all.filter((c) => !c.isBase && c.meal === selected.meal)]
      : all;

    const bundles = inView.filter((c) => !c.isBase).map((c) => this.bundleEntry(c));
    const items = inView
      .filter((c) => c.isBase)
      .flatMap((c) => c.items.map((item) => this.itemEntry(c, item)));
    const recipes = this.collections.recipes
      .filter((recipe) => !selected || selected.recipeIds.includes(recipe.id))
      .map((recipe) => this.recipeEntry(recipe));

    return [...bundles, ...items, ...recipes];
  }

  /** Looks up a route id: a dish, a bundle (`col:<id>`) or a standalone food. */
  detailFor(routeId: string): RecipeDetail | null {
    if (routeId.startsWith(BUNDLE_ID_PREFIX)) {
      const collection = this.editableCollectionFor(routeId);
      return collection ? this.bundleDetail(collection) : null;
    }
    const recipe = this.collections.recipeById(routeId);
    if (recipe) {
      return this.recipeDetail(recipe);
    }
    const owner = this.collections
      .collections()
      .find((collection) => collection.items.some((item) => item.id === routeId));
    const item = owner?.items.find((candidate) => candidate.id === routeId);
    return owner && item ? this.itemDetail(owner, item) : null;
  }

  /**
   * The user collection behind a bundle id (`col:<id>`), i.e. the one the recipe screen may edit
   * and delete. `null` for dishes, standalone foods, base collections and unknown ids.
   */
  editableCollectionFor(routeId: string): FoodCollection | null {
    if (!routeId.startsWith(BUNDLE_ID_PREFIX)) {
      return null;
    }
    const collection = this.collections.collectionById(routeId.slice(BUNDLE_ID_PREFIX.length));
    return collection && !collection.isBase ? collection : null;
  }

  // --- Rows ------------------------------------------------------------------------------

  private bundleEntry(collection: FoodCollection): CollectionEntry {
    const macros = sumMacros(collection.items);
    const count = countLabel(this.t, collection.items.length);
    const baseName = this.baseNameFor(collection.meal);
    return {
      id: `${BUNDLE_ID_PREFIX}${collection.id}`,
      title: collection.name,
      subtitle: itemNames(this.t, collection.items),
      meta: baseName ? `${baseName} · ${count}` : count,
      macrosText: macrosText(this.t, macros),
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
    };
  }

  private itemEntry(collection: FoodCollection, item: FoodItem): CollectionEntry {
    return {
      id: item.id,
      title: item.name,
      subtitle: item.brand ?? item.quantity,
      meta: `${collection.name} · ${item.quantity}`,
      macrosText: macrosText(this.t, item),
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
    };
  }

  private recipeEntry(recipe: Recipe): CollectionEntry {
    const collection = this.collections.collectionForRecipe(recipe.id);
    return {
      id: recipe.id,
      title: recipe.title,
      subtitle: recipe.subtitle,
      meta: this.t('collections.view.recipeMeta', {
        category: collection?.name ?? recipe.category,
        minutes: recipe.timeMinutes,
      }),
      macrosText: macrosText(this.t, recipe),
      icon: collection?.icon ?? RECIPE_FALLBACK_ICON,
      tone: MEAL_TONES[recipe.meal],
    };
  }

  // --- Recipe screen -----------------------------------------------------------------------

  private bundleDetail(collection: FoodCollection): RecipeDetail {
    return {
      id: `${BUNDLE_ID_PREFIX}${collection.id}`,
      title: collection.name,
      subtitle: itemNames(this.t, collection.items),
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
      meal: collection.meal,
      macros: sumMacros(collection.items),
      contents: collection.items.map((item) => ({ name: item.name, quantity: item.quantity })),
    };
  }

  private recipeDetail(recipe: Recipe): RecipeDetail {
    const collection = this.collections.collectionForRecipe(recipe.id);
    return {
      id: recipe.id,
      title: recipe.title,
      subtitle: recipe.subtitle,
      icon: collection?.icon ?? RECIPE_FALLBACK_ICON,
      tone: MEAL_TONES[recipe.meal],
      meal: recipe.meal,
      macros: { kcal: recipe.kcal, protein: recipe.protein, carbs: recipe.carbs, fat: recipe.fat },
      contents: recipe.ingredients,
    };
  }

  private itemDetail(collection: FoodCollection, item: FoodItem): RecipeDetail {
    return {
      id: item.id,
      title: item.name,
      subtitle: item.brand ?? item.quantity,
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
      meal: collection.meal,
      macros: { kcal: item.kcal, protein: item.protein, carbs: item.carbs, fat: item.fat },
      contents: [{ name: item.name, quantity: item.quantity }],
    };
  }

  /** The name of the fixed collection for the meal. Empty until the backend provides the collections. */
  private baseNameFor(meal: MealId): string {
    return this.collections.baseCollections().find((c) => c.meal === meal)?.name ?? '';
  }
}
