import { FoodItem } from '../../../core/models/food';
import { MealId } from '../../../core/models/meal';

/**
 * Historikkens syntetiske indhold fra designprototypen (`histAll`, `histMaal`, `histMeals`).
 * Kun vejningerne er rigtige data – de kommer fra `WeightLogService`. Resten ligger her,
 * fordi det udelukkende bruges af historikken og ikke er app-dækkende demo-data.
 */

/** Designets dagsopsamlinger: afvigelsen fra dagens kaloriemål. Negativ = målet holdt. */
export interface DemoDaySummarySeed {
  readonly daysAgo: number;
  readonly deltaKcal: number;
}

export const DEMO_DAY_SUMMARIES: readonly DemoDaySummarySeed[] = [
  { daysAgo: 1, deltaKcal: -40 },
  { daysAgo: 3, deltaKcal: 180 },
  { daysAgo: 5, deltaKcal: -110 },
];

export const DAY_SUMMARY_TITLE_UNDER = 'Dagsmål nået';
export const DAY_SUMMARY_TITLE_OVER = 'Over dagsmål';

/** Designets måltidsposter. `subtitle` er kopieret ordret (bemærk `Snack`, ikke `Snacks`). */
export interface DemoHistoryMealSeed {
  readonly daysAgo: number;
  readonly meal: MealId;
  readonly subtitle: string;
  readonly food: FoodItem;
}

export const DEMO_HISTORY_MEALS: readonly DemoHistoryMealSeed[] = [
  {
    daysAgo: 1,
    meal: 'morgen',
    subtitle: 'Morgenmad · 250 g',
    food: {
      id: 'history-skyr-bowl',
      name: 'Skyr-bowl med bær',
      quantity: '250 g',
      kcal: 380,
      protein: 32,
      carbs: 38,
      fat: 9,
    },
  },
  {
    daysAgo: 1,
    meal: 'frokost',
    subtitle: 'Frokost · 1 portion',
    food: {
      id: 'history-kyllingesalat',
      name: 'Kyllingesalat',
      quantity: '1 portion',
      kcal: 450,
      protein: 41,
      carbs: 18,
      fat: 22,
    },
  },
  {
    daysAgo: 2,
    meal: 'aften',
    subtitle: 'Aftensmad · 1 portion',
    food: {
      id: 'history-laks',
      name: 'Laks med kartofler',
      quantity: '1 portion',
      kcal: 610,
      protein: 44,
      carbs: 45,
      fat: 26,
    },
  },
  {
    daysAgo: 2,
    meal: 'snack',
    subtitle: 'Snack · 55 g',
    food: {
      id: 'history-proteinbar',
      name: 'Proteinbar',
      quantity: '55 g',
      kcal: 210,
      protein: 20,
      carbs: 22,
      fat: 7,
    },
  },
];

/** Designets fire "mål og indstillinger"-poster. Værdierne regnes ud fra den rigtige profil. */
export const DEMO_GOAL_CHANGES = {
  KCAL_TARGET: { daysAgo: 2, deltaKcal: 120, title: 'Dagligt mål ændret' },
  GOAL_WEIGHT: { daysAgo: 4, deltaKg: 2, title: 'Målvægt ændret' },
  HEIGHT: { daysAgo: 5, deltaCm: 1, title: 'Højde opdateret' },
  PACE: {
    daysAgo: 6,
    title: 'Tempo ændret',
    fromLabel: 'Roligt',
    fallbackLabel: 'moderat',
    fallbackRateLabel: '0,5 kg/uge',
  },
} as const;

/** Vejningens undertekst: den nyeste har designets lange variant, resten den korte. */
export const WEIGH_TITLE = 'Vejning';
export const WEIGH_SUBTITLE_LATEST = 'Morgen, før morgenmad';
export const WEIGH_SUBTITLE = 'Morgen';
