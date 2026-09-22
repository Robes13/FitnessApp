import { FoodCollection, FoodItem, LoggedFood, Recipe } from '../models/food';
import { UserProfile } from '../models/profile';
import { STEPS_DEFAULT, TRAINING_DEFAULT_MINUTES } from './nutrition';

/** Designets `foodDb` – den syntetiske varedatabase, søgningen kører på. */
export const FOOD_DATABASE: readonly FoodItem[] = [
  {
    id: 'food-havregryn',
    name: 'Havregryn',
    quantity: '60 g',
    kcal: 222,
    protein: 8,
    carbs: 38,
    fat: 4,
  },
  {
    id: 'food-skyr-naturel',
    name: 'Skyr naturel',
    quantity: '200 g',
    kcal: 128,
    protein: 22,
    carbs: 8,
    fat: 0,
  },
  { id: 'food-banan', name: 'Banan', quantity: '1 stk', kcal: 105, protein: 1, carbs: 27, fat: 0 },
  {
    id: 'food-kyllingebryst',
    name: 'Kyllingebryst',
    quantity: '150 g',
    kcal: 248,
    protein: 46,
    carbs: 0,
    fat: 5,
  },
  {
    id: 'food-rugbroed',
    name: 'Rugbrød',
    quantity: '1 skive',
    kcal: 90,
    protein: 3,
    carbs: 16,
    fat: 1,
  },
  { id: 'food-aeg', name: 'Æg', quantity: '1 stk', kcal: 78, protein: 6, carbs: 1, fat: 5 },
  {
    id: 'food-ris-kogt',
    name: 'Ris, kogt',
    quantity: '150 g',
    kcal: 195,
    protein: 4,
    carbs: 42,
    fat: 0,
  },
  { id: 'food-laks', name: 'Laks', quantity: '125 g', kcal: 260, protein: 25, carbs: 0, fat: 17 },
  {
    id: 'food-broccoli',
    name: 'Broccoli',
    quantity: '100 g',
    kcal: 34,
    protein: 3,
    carbs: 7,
    fat: 0,
  },
  {
    id: 'food-proteinbar',
    name: 'Proteinbar',
    quantity: '55 g',
    kcal: 210,
    protein: 20,
    carbs: 22,
    fat: 7,
  },
];

/** Designets `recipeDb`. */
export const RECIPES: readonly Recipe[] = [
  {
    id: 'skyr',
    category: 'Morgenmad',
    meal: 'morgen',
    title: 'Skyr-bowl med bær og nødder',
    subtitle: 'Mætter til frokost og tager fem minutter.',
    timeMinutes: 5,
    servings: '1 portion',
    kcal: 380,
    protein: 32,
    carbs: 38,
    fat: 11,
    ingredients: [
      { name: 'Skyr, naturel', quantity: '250 g' },
      { name: 'Blandede bær', quantity: '100 g' },
      { name: 'Havregryn', quantity: '30 g' },
      { name: 'Mandler, hakkede', quantity: '15 g' },
      { name: 'Honning', quantity: '1 tsk' },
    ],
    steps: [
      'Kom skyr i en skål og rør den glat.',
      'Vend havregryn i, og lad den stå to minutter.',
      'Top med bær, mandler og en smule honning.',
    ],
  },
  {
    id: 'omelet',
    category: 'Morgenmad',
    meal: 'morgen',
    title: 'Omelet med spinat og feta',
    subtitle: 'Tre æg, lidt grønt og en pande.',
    timeMinutes: 10,
    servings: '1 portion',
    kcal: 420,
    protein: 29,
    carbs: 6,
    fat: 31,
    ingredients: [
      { name: 'Æg', quantity: '3 stk' },
      { name: 'Frisk spinat', quantity: '50 g' },
      { name: 'Feta', quantity: '30 g' },
      { name: 'Olivenolie', quantity: '1 tsk' },
      { name: 'Salt og peber', quantity: 'efter smag' },
    ],
    steps: [
      'Pisk æggene let sammen med salt og peber.',
      'Svits spinaten i olien, indtil den falder sammen.',
      'Hæld æggene over, og lad dem stivne ved svag varme.',
      'Drys feta over, og fold omeletten sammen.',
    ],
  },
  {
    id: 'kylsalat',
    category: 'Frokost',
    meal: 'frokost',
    title: 'Kyllingesalat med kikærter',
    subtitle: 'Meal prep-venlig og holder to dage i køleskabet.',
    timeMinutes: 20,
    servings: '2 portioner',
    kcal: 490,
    protein: 41,
    carbs: 34,
    fat: 19,
    ingredients: [
      { name: 'Kyllingebryst', quantity: '300 g' },
      { name: 'Kikærter, afdryppede', quantity: '240 g' },
      { name: 'Agurk', quantity: '½ stk' },
      { name: 'Cherrytomater', quantity: '150 g' },
      { name: 'Græsk yoghurt', quantity: '2 spsk' },
      { name: 'Citron', quantity: '½ stk' },
    ],
    steps: [
      'Steg kyllingen gennem, og lad den hvile fem minutter.',
      'Skær agurk og tomater i grove stykker.',
      'Rør yoghurt med citronsaft, salt og peber.',
      'Vend alt sammen, og skær kyllingen i skiver ovenpå.',
    ],
  },
  {
    id: 'wrap',
    category: 'Frokost',
    meal: 'frokost',
    title: 'Tunwrap med rødkål',
    subtitle: 'Klar på ti minutter, nem at tage med.',
    timeMinutes: 10,
    servings: '1 portion',
    kcal: 450,
    protein: 34,
    carbs: 45,
    fat: 13,
    ingredients: [
      { name: 'Fuldkornstortilla', quantity: '1 stk' },
      { name: 'Tun i vand', quantity: '1 dåse' },
      { name: 'Græsk yoghurt', quantity: '2 spsk' },
      { name: 'Rødkål, snittet', quantity: '80 g' },
      { name: 'Majs', quantity: '40 g' },
    ],
    steps: [
      'Bland tun med yoghurt, salt og peber.',
      'Fordel blandingen på tortillaen.',
      'Top med rødkål og majs, og rul stramt sammen.',
    ],
  },
  {
    id: 'laks',
    category: 'Aftensmad',
    meal: 'aften',
    title: 'Ovnlaks med rodfrugter',
    subtitle: 'Én bradepande, 25 minutter i ovnen.',
    timeMinutes: 35,
    servings: '2 portioner',
    kcal: 610,
    protein: 44,
    carbs: 42,
    fat: 28,
    ingredients: [
      { name: 'Laksefilet', quantity: '2 stk' },
      { name: 'Kartofler', quantity: '400 g' },
      { name: 'Gulerødder', quantity: '2 stk' },
      { name: 'Olivenolie', quantity: '1 spsk' },
      { name: 'Citron', quantity: '1 stk' },
      { name: 'Timian', quantity: '2 kviste' },
    ],
    steps: [
      'Tænd ovnen på 200 grader.',
      'Skær rodfrugterne i både, og vend dem i olie, salt og timian.',
      'Bag dem 20 minutter.',
      'Læg laksen ovenpå, og bag 12-14 minutter mere. Server med citron.',
    ],
  },
  {
    id: 'gryde',
    category: 'Aftensmad',
    meal: 'aften',
    title: 'Kylling i tomatgryde',
    subtitle: 'God at lave dobbelt portion af.',
    timeMinutes: 30,
    servings: '3 portioner',
    kcal: 520,
    protein: 46,
    carbs: 33,
    fat: 20,
    ingredients: [
      { name: 'Kyllingeoverlår', quantity: '600 g' },
      { name: 'Hakkede tomater', quantity: '400 g' },
      { name: 'Løg', quantity: '1 stk' },
      { name: 'Hvidløg', quantity: '2 fed' },
      { name: 'Paprika', quantity: '1 tsk' },
      { name: 'Fuldkornsris', quantity: '150 g' },
    ],
    steps: [
      'Brun kyllingen i en gryde, og tag den op.',
      'Svits løg, hvidløg og paprika i to minutter.',
      'Tilsæt tomater og kyllingen, og lad det simre 20 minutter.',
      'Kog risene, og server gryden ovenpå.',
    ],
  },
  {
    id: 'protein',
    category: 'Snack',
    meal: 'snack',
    title: 'Proteinshake med banan',
    subtitle: 'Til efter træning, når du har travlt.',
    timeMinutes: 3,
    servings: '1 portion',
    kcal: 290,
    protein: 28,
    carbs: 33,
    fat: 5,
    ingredients: [
      { name: 'Proteinpulver', quantity: '30 g' },
      { name: 'Banan', quantity: '1 stk' },
      { name: 'Mælk, skummet', quantity: '3 dl' },
      { name: 'Kanel', quantity: '1 knivspids' },
    ],
    steps: ['Kom alt i blenderen.', 'Blend 30 sekunder, indtil den er ensartet.'],
  },
  {
    id: 'hummus',
    category: 'Snack',
    meal: 'snack',
    title: 'Hummus med grønt',
    subtitle: 'Mellemmåltid der ikke vælter dagen.',
    timeMinutes: 8,
    servings: '2 portioner',
    kcal: 210,
    protein: 9,
    carbs: 20,
    fat: 11,
    ingredients: [
      { name: 'Hummus', quantity: '100 g' },
      { name: 'Gulerødder', quantity: '2 stk' },
      { name: 'Agurk', quantity: '½ stk' },
      { name: 'Peberfrugt', quantity: '1 stk' },
    ],
    steps: ['Skær grøntsagerne i stave.', 'Server dem med hummus i en lille skål.'],
  },
];

/** Designets `colDefault` – de fire faste samlinger, én pr. måltid. */
export const BASE_COLLECTIONS: readonly FoodCollection[] = [
  {
    id: 'c1',
    name: 'Morgenmad',
    icon: 'egg',
    meal: 'morgen',
    isBase: true,
    recipeIds: ['skyr', 'omelet'],
    items: [],
  },
  {
    id: 'c2',
    name: 'Frokost',
    icon: 'salad',
    meal: 'frokost',
    isBase: true,
    recipeIds: ['kylsalat', 'wrap'],
    items: [],
  },
  {
    id: 'c3',
    name: 'Aftensmad',
    icon: 'utensils',
    meal: 'aften',
    isBase: true,
    recipeIds: ['laks', 'gryde'],
    items: [],
  },
  {
    id: 'c4',
    name: 'Snacks',
    icon: 'cookie',
    meal: 'snack',
    isBase: true,
    recipeIds: ['protein', 'hummus'],
    items: [],
  },
];

/** En vare med måltid, men uden log-id og tidsstempel – dem sætter `FoodLogService` ved seed. */
export type DemoLoggedFood = Omit<LoggedFood, 'logId' | 'loggedAt'>;

/** Designets to registrerede varer i `state.logged`. Seedes kun første gang appen åbnes. */
export const DEMO_LOGGED_FOODS: readonly DemoLoggedFood[] = [
  {
    id: 'demo-skyr-bowl',
    name: 'Skyr-bowl med bær',
    quantity: '250 g',
    kcal: 380,
    protein: 32,
    carbs: 38,
    fat: 9,
    meal: 'morgen',
  },
  {
    id: 'demo-kyllingesalat',
    name: 'Kyllingesalat',
    quantity: '1 portion',
    kcal: 450,
    protein: 41,
    carbs: 18,
    fat: 22,
    meal: 'frokost',
  },
];

/** Varen som dummy-scanneren "finder" (designets `scanBase`). */
export const SCANNED_DEMO_ITEM: FoodItem = {
  id: 'scan-proteinbar-choko',
  name: 'Proteinbar Choko',
  brand: 'Nutrify Select',
  quantity: '55 g',
  kcal: 210,
  protein: 20,
  carbs: 22,
  fat: 7,
};

/** Designets start-`state` for profilen. Brugernavn og e-mail er tomme, indtil brugeren udfylder dem. */
export const DEMO_PROFILE_DEFAULTS: UserProfile = {
  username: '',
  email: '',
  birthday: null,
  gender: null,
  weightKg: 75,
  heightCm: 178,
  stepsPerDay: STEPS_DEFAULT,
  trainingDays: [true, false, true, false, true, false, false],
  trainingMinutes: TRAINING_DEFAULT_MINUTES,
  trainingRpe: null,
  goal: null,
  pace: null,
  goalWeightKg: 70,
  notificationsEnabled: true,
  units: 'metrisk',
  kcalOverride: null,
  photo: null,
};

/** Navnet designet viser, når brugernavnet er tomt (`displayName`). */
export const DEFAULT_DISPLAY_NAME = 'Mads';

/**
 * De tre demo-vejninger designet starter med (`wlog`): dagens vægt for 3 dage siden og
 * to ældre målinger, der ligger lidt over (mål: tabe/hold) eller under (mål: tage).
 */
export interface DemoWeighSeed {
  readonly daysAgo: number;
  readonly deltaKg: number;
  readonly deltaKgWhenGaining: number;
}

export const DEMO_WEIGHT_SEED: readonly DemoWeighSeed[] = [
  { daysAgo: 3, deltaKg: 0, deltaKgWhenGaining: 0 },
  { daysAgo: 7, deltaKg: 0.6, deltaKgWhenGaining: -0.4 },
  { daysAgo: 14, deltaKg: 1.1, deltaKgWhenGaining: -0.9 },
];
