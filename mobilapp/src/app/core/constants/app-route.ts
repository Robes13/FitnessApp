export const APP_ROUTE = {
  ROOT: '',
  LOGIN: 'login',
  FORGOT_PASSWORD: 'glemt-adgangskode',
  SIGNUP: 'opret',
  HOME: 'hjem',
  FOOD: 'mad',
  WEIGHT: 'vaegt',
  COLLECTIONS: 'samling',
  HISTORY: 'historik',
  PROFILE: 'profil',
} as const;

export const ROUTE_PARAM = { RECIPE_ID: 'recipeId' } as const;

/** `/mad?tilfoej=morgen` opens the add sheet with that meal selected. */
export const QUERY_PARAM = { ADD_MEAL: 'tilfoej' } as const;

export const APP_PATH = {
  LOGIN: `/${APP_ROUTE.LOGIN}`,
  FORGOT_PASSWORD: `/${APP_ROUTE.FORGOT_PASSWORD}`,
  SIGNUP: `/${APP_ROUTE.SIGNUP}`,
  HOME: `/${APP_ROUTE.HOME}`,
  FOOD: `/${APP_ROUTE.FOOD}`,
  WEIGHT: `/${APP_ROUTE.WEIGHT}`,
  COLLECTIONS: `/${APP_ROUTE.COLLECTIONS}`,
  HISTORY: `/${APP_ROUTE.HISTORY}`,
  PROFILE: `/${APP_ROUTE.PROFILE}`,
  recipe: (recipeId: string) => `/${APP_ROUTE.COLLECTIONS}/${recipeId}`,
} as const;
