import { DOCUMENT, Provider } from '@angular/core';
import { of } from 'rxjs';
import { FoodCatalogueService } from '../services/food-catalogue/food-catalogue';
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

/**
 * A frozen `NOW` and an empty shared food catalogue – shared by both environments. A spec of the
 * catalogue provides `FoodCatalogueService` itself (or uses the real one via `TestBed.overrideProvider`).
 */
function deterministicProviders(now: Date): Provider[] {
  return [
    { provide: NOW, useValue: () => new Date(now) },
    {
      provide: FoodCatalogueService,
      useValue: { findByBarcode: () => of(null), search: () => of([]) },
    },
  ];
}

/**
 * Providers for **service specs**: a fake `DOCUMENT` (with in-memory storage) and a frozen
 * `NOW`, so specs are fast and deterministic.
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
 * `TestBed.createComponent()` can render, while `NOW` is still frozen.
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
