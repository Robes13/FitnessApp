/**
 * Nøgler i en rutes `data`. Shell'en læser dem; features skriver dem i deres egne route-filer
 * (en feature må ikke importere fra shell'en, men begge må importere fra `core`).
 *
 * `data: { [ROUTE_DATA.HIDE_TAB_BAR]: true }` skjuler tab baren, mens ruten er den dybeste
 * aktive – designets `navVisible`, fx opskriftsiden under Samling.
 */
export const ROUTE_DATA = { HIDE_TAB_BAR: 'hideTabBar' } as const;
