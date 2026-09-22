/**
 * Keys in a route's `data`. The shell reads them; features write them in their own route
 * files (a feature must not import from the shell, but both may import from `core`).
 *
 * `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }` hides the tab bar while the route is the
 * deepest active one – the design's `navVisible`, e.g. the recipe page under Collections.
 */
export const ROUTE_DATA = { HIDE_TAB_BAR: 'hideTabBar' } as const;
