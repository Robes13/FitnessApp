import { DOCUMENT, Provider } from '@angular/core';
import { AUTH_API_DELAY_MS } from '../services/auth-api';
import { SCAN_DELAY_MS } from '../services/barcode-scanner';
import { FOOD_SEARCH_DELAY_MS } from '../services/food-search';
import { NOW } from '../utils/now';
import { FakeStorage, createFakeDocument, createFakeStorage } from './fake-document';

/** Mandag 21. september 2026, kl. 10:30 – fast "nu" i tests. */
export const TEST_NOW = new Date(2026, 8, 21, 10, 30);

export interface CoreTestEnvironmentOptions {
  readonly now?: Date;
  readonly storage?: FakeStorage;
}

export interface ComponentTestEnvironmentOptions {
  readonly now?: Date;
}

/** Fastfrosset `NOW` og alle mock-forsinkelser sat til 0 ms – fælles for begge miljøer. */
function deterministicProviders(now: Date): Provider[] {
  return [
    { provide: NOW, useValue: () => new Date(now) },
    { provide: AUTH_API_DELAY_MS, useValue: 0 },
    { provide: FOOD_SEARCH_DELAY_MS, useValue: 0 },
    { provide: SCAN_DELAY_MS, useValue: 0 },
  ];
}

/**
 * Providers til **service-specs**: falsk `DOCUMENT` (med storage i hukommelsen), fastfrosset
 * `NOW` og alle mock-forsinkelser sat til 0 ms, så specs er hurtige og deterministiske.
 *
 * Det falske dokument kan ikke rendere en komponent – brug
 * `provideComponentTestEnvironment()` til specs, der kalder `TestBed.createComponent()`.
 */
export function provideCoreTestEnvironment(options: CoreTestEnvironmentOptions = {}): Provider[] {
  const storage = options.storage ?? createFakeStorage();
  return [
    { provide: DOCUMENT, useValue: createFakeDocument(storage) },
    ...deterministicProviders(options.now ?? TEST_NOW),
  ];
}

/**
 * Providers til **komponent-specs**. Her beholdes jsdom's rigtige `DOCUMENT`, så
 * `TestBed.createComponent()` kan rendere, mens `NOW` stadig er fastfrosset og alle
 * mock-forsinkelser er 0 ms.
 *
 * Funktionen har ingen sideeffekter: browserens `localStorage` deles mellem tests, så
 * spec'en rydder (og seeder) den selv med `resetComponentTestStorage()` i `beforeEach`.
 */
export function provideComponentTestEnvironment(
  options: ComponentTestEnvironmentOptions = {},
): Provider[] {
  return deterministicProviders(options.now ?? TEST_NOW);
}

/**
 * Rydder browserens `localStorage` mellem komponenttests og lægger eventuelle `seed`-nøgler
 * ind igen. Værdierne JSON-kodes, præcis som `StorageService` gemmer dem.
 */
export function resetComponentTestStorage(seed: Readonly<Record<string, unknown>> = {}): void {
  window.localStorage.clear();
  for (const [key, value] of Object.entries(seed)) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
