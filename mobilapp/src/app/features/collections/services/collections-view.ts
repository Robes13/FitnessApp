import { Injectable, computed, inject } from '@angular/core';
import { StoreStatus } from '../../../core/models/api';
import { CollectionItem, FoodCollection, Macros } from '../../../core/models/food';
import { CollectionsService } from '../../../core/services/collections/collections';
import { FoodLogService } from '../../../core/services/food-log/food-log';
import { Translate, injectTranslate } from '../../../core/services/language/translate';
import { formatGrams } from '../../../core/utils/date-format';

/** The prefix in front of a collection's id in the recipe screen's route (`col:<id>`). */
export const BUNDLE_ID_PREFIX = 'col:';

/** A collection as a row in the list on the collections screen. */
export interface CollectionEntry {
  /** The route id, `col:<id>`. */
  readonly id: string;
  readonly title: string;
  /** The names of the items. */
  readonly subtitle: string;
  /** The small uppercase line above the title, e.g. `2 varer`. */
  readonly meta: string;
  /** `'420 kcal · 31,5 g protein'` */
  readonly macrosText: string;
}

/** Everything the recipe screen shows of a collection. */
export interface RecipeDetail {
  readonly title: string;
  readonly subtitle: string;
  readonly macros: Macros;
  readonly contents: readonly CollectionItem[];
}

function countLabel(t: Translate, count: number): string {
  return count === 1
    ? t('collections.view.itemCountOne')
    : t('collections.view.itemCountMany', { count });
}

function itemNames(collection: FoodCollection): string {
  return collection.items.map((item) => item.name).join(', ');
}

/**
 * Builds the collections screen's rows and the recipe screen's data from `CollectionsService`.
 * Every collection is a "bundle" of the user's own items – the API has no dishes, no fixed
 * collections and no icon or meal on a collection (P13).
 */
@Injectable({ providedIn: 'root' })
export class CollectionsViewService {
  private readonly collections = inject(CollectionsService);
  private readonly foodLog = inject(FoodLogService);
  private readonly t = injectTranslate();

  /** The screens' load state: the collections and the foods their nutrition is scaled from. */
  readonly status = computed<StoreStatus>(() => {
    const stores = [this.collections.status(), this.foodLog.status()];
    if (stores.includes('error')) {
      return 'error';
    }
    return stores.includes('loading') ? 'loading' : 'ready';
  });

  /** "Prøv igen": reloads the store(s) that failed. */
  retry(): void {
    if (this.collections.status() === 'error') {
      this.collections.load().subscribe();
    }
    if (this.foodLog.status() === 'error') {
      this.foodLog.load().subscribe();
    }
  }

  /** The list's rows, newest collection first. */
  entries(): readonly CollectionEntry[] {
    return this.collections.collections().map((collection) => {
      const totals = this.collections.collectionTotals(collection);
      return {
        id: `${BUNDLE_ID_PREFIX}${collection.id}`,
        title: collection.name,
        subtitle: itemNames(collection),
        meta: countLabel(this.t, totals.count),
        macrosText: this.t('collections.view.macros', {
          kcal: Math.round(totals.kcal),
          protein: formatGrams(totals.protein),
        }),
      };
    });
  }

  /** The recipe screen's data for a route id, or `null` when no collection has it. */
  detailFor(routeId: string): RecipeDetail | null {
    const collection = this.collectionFor(routeId);
    if (!collection) {
      return null;
    }
    return {
      title: collection.name,
      subtitle: itemNames(collection),
      macros: this.collections.collectionTotals(collection),
      contents: collection.items,
    };
  }

  /** The collection behind a route id (`col:<id>`); `null` for anything else. */
  collectionFor(routeId: string): FoodCollection | null {
    return routeId.startsWith(BUNDLE_ID_PREFIX)
      ? (this.collections.collectionById(routeId.slice(BUNDLE_ID_PREFIX.length)) ?? null)
      : null;
  }
}
