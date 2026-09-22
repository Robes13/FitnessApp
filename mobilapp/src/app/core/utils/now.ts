import { InjectionToken } from '@angular/core';

export type DateProvider = () => Date;

/**
 * Leverer "nu". Services og features injicerer denne i stedet for at kalde `new Date()`
 * direkte, så tests kan fastfryse tiden: `{ provide: NOW, useValue: () => new Date(2026, 8, 21) }`.
 */
export const NOW = new InjectionToken<DateProvider>('NOW', {
  providedIn: 'root',
  factory: () => () => new Date(),
});
