import { Injectable, inject } from '@angular/core';
import { CollectionIconName } from '../../../core/constants/collection-icons';
import { FoodCollection, FoodItem, Ingredient, Macros, Recipe } from '../../../core/models/food';
import { MEAL_TONES } from '../../../core/constants/meals';
import { MealId, MealTone } from '../../../core/models/meal';
import { CollectionsService } from '../../../core/services/collections';

/** Præfikset foran en samlings id, når hele samlingen åbnes som ét "bundt". */
export const BUNDLE_ID_PREFIX = 'col:';

const EMPTY_SUBTITLE = 'Ingen varer endnu';
const ALL_CHIP_LABEL = 'Alle';

/** En række i listen på samlingsskærmen: et bundt, en løs vare eller en ret. */
export interface CollectionEntry {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** Den lille versale linje over titlen, fx `Morgenmad · 5 min`. */
  readonly meta: string;
  readonly kcal: number;
  readonly protein: number;
  readonly icon: CollectionIconName;
  readonly tone: MealTone;
}

/** Filter-chip over listen. `id` er `null` på "Alle". */
export interface CollectionFilterChip {
  readonly id: string | null;
  readonly label: string;
}

/** Alt opskriftsskærmen skal bruge – uanset om kilden er en ret, et bundt eller en vare. */
export interface RecipeDetail {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: CollectionIconName;
  readonly tone: MealTone;
  /** Måltidet, "Log som spist under" starter på. */
  readonly meal: MealId;
  readonly macros: Macros;
  readonly contents: readonly Ingredient[];
}

function countLabel(count: number): string {
  return count === 1 ? '1 vare' : `${count} varer`;
}

function itemNames(items: readonly FoodItem[]): string {
  return items.length > 0 ? items.map((item) => item.name).join(', ') : EMPTY_SUBTITLE;
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
 * Bygger samlingsskærmens rækker og opskriftsskærmens data ud fra `CollectionsService`.
 *
 * Designet blander tre slags rækker i én liste (`recipes` i `logic.js`): brugerens egne
 * samlinger vist som ét bundt, løse varer lagt i de faste samlinger, og retterne selv.
 * Rækkefølgen og filtreringen er en direkte oversættelse af `colsInView` / `userCols` /
 * `baseCols` derfra.
 *
 * Farven er bundet til måltidet i stedet for designets samlings-id (`c1`–`c4`), fordi
 * modellen i `core` har et rigtigt `meal`-felt. Resultatet er det samme: morgenmad orange,
 * frokost grøn, aftensmad blå, snacks rød – også for brugerens egne samlinger.
 */
@Injectable({ providedIn: 'root' })
export class CollectionsViewService {
  private readonly collections = inject(CollectionsService);

  /** "Alle" efterfulgt af de fire faste samlinger. */
  chips(): readonly CollectionFilterChip[] {
    return [
      { id: null, label: ALL_CHIP_LABEL },
      ...this.collections
        .baseCollections()
        .map((collection) => ({ id: collection.id, label: collection.name })),
    ];
  }

  /**
   * Rækkerne for det valgte filter. `null` viser alt; ellers vises den valgte faste samling,
   * dens løse varer, dens retter og brugerens egne samlinger med samme måltid.
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

  /** Slår et rute-id op: en ret, et bundt (`col:<id>`) eller en løs vare. */
  detailFor(routeId: string): RecipeDetail | null {
    if (routeId.startsWith(BUNDLE_ID_PREFIX)) {
      const collection = this.collections.collectionById(routeId.slice(BUNDLE_ID_PREFIX.length));
      return collection && !collection.isBase ? this.bundleDetail(collection) : null;
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

  // --- Rækker ---------------------------------------------------------------------------

  private bundleEntry(collection: FoodCollection): CollectionEntry {
    const macros = sumMacros(collection.items);
    const count = countLabel(collection.items.length);
    const baseName = this.baseNameFor(collection.meal);
    return {
      id: `${BUNDLE_ID_PREFIX}${collection.id}`,
      title: collection.name,
      subtitle: itemNames(collection.items),
      meta: baseName ? `${baseName} · ${count}` : count,
      kcal: macros.kcal,
      protein: macros.protein,
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
      kcal: item.kcal,
      protein: item.protein,
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
      meta: `${collection.name} · ${recipe.timeMinutes} min`,
      kcal: recipe.kcal,
      protein: recipe.protein,
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
    };
  }

  // --- Opskriftsskærmen -----------------------------------------------------------------

  private bundleDetail(collection: FoodCollection): RecipeDetail {
    return {
      id: `${BUNDLE_ID_PREFIX}${collection.id}`,
      title: collection.name,
      subtitle: itemNames(collection.items),
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
      icon: collection.icon,
      tone: MEAL_TONES[collection.meal],
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

  private baseNameFor(meal: MealId): string {
    return this.collections.baseCollections().find((c) => c.meal === meal)?.name ?? '';
  }
}
