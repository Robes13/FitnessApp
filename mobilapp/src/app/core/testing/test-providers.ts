import { DOCUMENT, Provider } from '@angular/core';
import { AUTH_API_DELAY_MS } from '../services/auth-api';
import { SCAN_DELAY_MS } from '../services/barcode-scanner';
import { FOOD_SEARCH_DELAY_MS } from '../services/food-search';
import { NOW } from '../utils/now';
import { FakeStorage, createFakeDocument, createFakeStorage } from './fake-document';

/** Monday, September 21, 2026, 10:30 – a fixed "now" in tests. */
export const TEST_NOW = new Date(2026, 8, 21, 10, 30);

export interface CoreTestEnvironmentOptions {
  readonly now?: Date;
  readonly storage?: FakeStorage;
}

export interface ComponentTestEnvironmentOptions {
  readonly now?: Date;
}

/** Frozen `NOW` and all artificial delays set to 0 ms – shared by both environments. */
function deterministicProviders(now: Date): Provider[] {
  return [
    { provide: NOW, useValue: () => new Date(now) },
    { provide: FOOD_SEARCH_DELAY_MS, useValue: 0 },
    { provide: SCAN_DELAY_MS, useValue: 0 },
    { provide: AUTH_API_DELAY_MS, useValue: 0 },
  ];
}

/**
 * Providers for **service specs**: a fake `DOCUMENT` (with in-memory storage), a frozen
 * `NOW`, and all artificial delays set to 0 ms, so specs are fast and deterministic.
 *
 * The fake document can't render a component – use
 * `provideComponentTestEnvironment()` for specs that call `TestBed.createComponent()`.
 */
export function provideCoreTestEnvironment(options: CoreTestEnvironmentOptions = {}): Provider[] {
  const storage = options.storage ?? createFakeStorage();
  return [
    { provide: DOCUMENT, useValue: createFakeDocument(storage) },
    ...deterministicProviders(options.now ?? TEST_NOW),
  ];
}

/**
 * Providers for **component specs**. Here jsdom's real `DOCUMENT` is kept, so
 * `TestBed.createComponent()` can render, while `NOW` is still frozen and all
 * artificial delays are 0 ms.
 *
 * The function has no side effects: the browser's `localStorage` is shared between tests,
 * so the spec clears (and seeds) it itself with `resetComponentTestStorage()` in `beforeEach`.
 */
export function provideComponentTestEnvironment(
  options: ComponentTestEnvironmentOptions = {},
): Provider[] {
  return deterministicProviders(options.now ?? TEST_NOW);
}

/**
 * Clears the browser's `localStorage` between component tests and puts any `seed` keys
 * back in. The values are JSON-encoded, exactly as `StorageService` stores them.
 */
export function resetComponentTestStorage(seed: Readonly<Record<string, unknown>> = {}): void {
  window.localStorage.clear();
  for (const [key, value] of Object.entries(seed)) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}
