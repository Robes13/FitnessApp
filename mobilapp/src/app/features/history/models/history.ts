import { FoodItem } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';

/** Designets tre posttyper i historikken. Id'erne er også filtrenes id'er. */
export type HistoryKind = 'vejning' | 'mad' | 'maal';

export type HistoryFilterId = 'alle' | HistoryKind;

/** Farven på postens tal til højre (designets `valColor`). */
export type HistoryValueTone = 'default' | 'positive' | 'negative';

/** Én linje i historikken. `food` + `meal` er kun sat på måltidsposter, der kan logges igen. */
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

/** Posterne for én dag under overskriften `'I dag · 21. sep'`. */
export interface HistoryGroup {
  readonly label: string;
  readonly entries: readonly HistoryEntry[];
}

export interface HistoryFilter {
  readonly id: HistoryFilterId;
  readonly label: string;
}
