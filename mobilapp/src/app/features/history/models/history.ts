import { FoodItem } from '../../../core/models/food';
import { FoodLogDto } from '../../../core/models/food-api';
import { MealId } from '../../../core/models/meal';
import { UserGoalDto } from '../../../core/models/profile-api';
import { WeightLogDto } from '../../../core/models/weight';

/** The API's `HistoryEventType`, serialized by name. */
export type HistoryEventType =
  'AccountCreated' | 'GoalUpdated' | 'FoodLogged' | 'WeightRecorded' | 'AchievementCompleted';

/**
 * One event of `GET me/history` (plan-v2 A7). The payload matching `type` is set for
 * `FoodLogged` / `WeightRecorded` / `GoalUpdated`; the other two types have all three `null`.
 */
export interface HistoryEventDto {
  type: HistoryEventType;
  /** UTC timestamp. */
  occurredAt: string;
  referenceId: number;
  foodLog: FoodLogDto | null;
  weightLog: WeightLogDto | null;
  goal: UserGoalDto | null;
}

/** The entry types in the history – they pick the dot's color. */
export type HistoryKind = 'vejning' | 'mad' | 'maal' | 'konto';

export type HistoryFilterId = 'alle' | Exclude<HistoryKind, 'konto'>;

/** One line in the history. `food` + `meal` are only set on meal entries, which can be re-logged. */
export interface HistoryEntry {
  readonly id: string;
  readonly kind: HistoryKind;
  readonly title: string;
  readonly subtitle: string;
  readonly value: string;
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
  /** The day as `YYYY-MM-DD` – a language-independent key for grouping and `track`. */
  readonly id: string;
  readonly label: string;
  readonly entries: readonly HistoryEntry[];
  /**
   * The day's logged kcal and macros (`'1.970 kcal · P 120 g · K 210 g · F 60 g'`), or `null`
   * without meals and on the last loaded day while more pages remain.
   */
  readonly foodSummary: string | null;
}

export interface HistoryFilter {
  readonly id: HistoryFilterId;
  readonly labelKey: string;
  /** The `types` query of `GET me/history`: comma-separated `HistoryEventType`s. */
  readonly types: string;
}
