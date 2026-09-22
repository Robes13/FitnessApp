import { InjectionToken } from '@angular/core';

export type DateProvider = () => Date;

/**
 * Provides "now". Services and features inject this instead of calling `new Date()`
 * directly, so tests can freeze time: `{ provide: NOW, useValue: () => new Date(2026, 8, 21) }`.
 */
export const NOW = new InjectionToken<DateProvider>('NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
