/**
 * Minimal replacement for `DOCUMENT` in unit tests: a `documentElement` with attributes
 * and an in-memory `defaultView.localStorage`. Used as
 * `{ provide: DOCUMENT, useValue: createFakeDocument() }`, so tests touch neither the real
 * DOM nor the browser's storage.
 */
export interface FakeStorage {
  readonly data: Map<string, string>;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export interface FakeDocument {
  readonly documentElement: {
    readonly attributes: Map<string, string>;
    setAttribute(name: string, value: string): void;
    getAttribute(name: string): string | null;
    removeAttribute(name: string): void;
  };
  readonly defaultView: { readonly localStorage: FakeStorage };
}

export function createFakeStorage(seed: Readonly<Record<string, unknown>> = {}): FakeStorage {
  const data = new Map<string, string>(
    Object.entries(seed).map(([key, value]) => [key, JSON.stringify(value)]),
  );
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
}

export function createFakeDocument(storage: FakeStorage = createFakeStorage()): FakeDocument {
  const attributes = new Map<string, string>();
  return {
    documentElement: {
      attributes,
      setAttribute: (name, value) => {
        attributes.set(name, value);
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      removeAttribute: (name) => {
        attributes.delete(name);
      },
    },
    defaultView: { localStorage: storage },
  };
}
