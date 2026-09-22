import { FoodItem } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';

/** The design's three entry types in the history. The ids are also the filters' ids. */
export type HistoryKind = 'vejning' | 'mad' | 'maal';

export type HistoryFilterId = 'alle' | HistoryKind;

/** The color of the entry's number on the right (the design's `valColor`). */
export type HistoryValueTone = 'default' | 'positive' | 'negative';

/** One line in the history. `food` + `meal` are only set on meal entries, which can be re-logged. */
export interface HistoryEntry {
  readonly id: string;
  readonly kind: HistoryKind;
  readonly title: string;
  readonly subtitle: string;
  readonly value: string;
  readonly valueTone: HistoryValueTone;
  /** `'I dag'` · `'I går'` · `'Tir.'` */
  readonly when: string;
  /** `'21. sep'` */
  readonly whenDate: string;
  readonly date: Date;
  readonly food?: FoodItem;
  readonly meal?: MealId;
}

/** The entries for one day under the heading `'I dag · 21. sep'`. */
export interface HistoryGroup {
  readonly label: string;
  readonly entries: readonly HistoryEntry[];
  /** The day's logged kcal and macros (`'1.970 kcal · P 120 g · K 210 g · F 60 g'`), or `null` without meals. */
  readonly foodSummary: string | null;
}

export interface HistoryFilter {
  readonly id: HistoryFilterId;
  readonly label: string;
}
