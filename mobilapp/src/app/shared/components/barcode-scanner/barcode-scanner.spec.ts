import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject } from 'rxjs';
import {
  BarcodeScanOutcome,
  ProductLookupResult,
  ScannedProduct,
} from '../../../core/models/barcode';
import { FoodItem } from '../../../core/models/food';
import { injectTranslate } from '../../../core/services/language/translate';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner/barcode-scanner';
import { ProductLookupService } from '../../../core/services/product-lookup/product-lookup';
import { TEST_FOOD } from '../../../core/testing/fixtures';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../core/testing/test-providers';
import { BarcodeScanner, buildScanVerdict } from './barcode-scanner';

const BARCODE = '5701234567890';
const RETRY_DELAY_MS = 300;

/** A protein bar per 100 g with a 50 g serving. */
const PRODUCT: ScannedProduct = {
  barcode: BARCODE,
  unit: 'g',
  item: {
    id: `off-${BARCODE}`,
    name: 'Proteinbar Choko',
    brand: 'Nutrify Select',
    quantity: '100 g',
    kcal: 400,
    protein: 40,
    carbs: 30,
    fat: 12,
  },
  servingGrams: 50,
};

class FakeBarcodeScannerService {
  canScan = true;
  outcome: BarcodeScanOutcome = { status: 'scanned', barcode: BARCODE };
  scanCalls = 0;
  recorded = 0;
  settingsOpened = 0;

  async scan(): Promise<BarcodeScanOutcome> {
    this.scanCalls += 1;
    return this.outcome;
  }

  recordScan(): void {
    this.recorded += 1;
  }

  async openSettings(): Promise<void> {
    this.settingsOpened += 1;
  }
}

/** Each lookup gets its own subject, so a spec decides when (and what) the "network" answers. */
class FakeProductLookupService {
  readonly requests: { barcode: string; response: Subject<ProductLookupResult> }[] = [];

  lookup(barcode: string): Observable<ProductLookupResult> {
    const response = new Subject<ProductLookupResult>();
    this.requests.push({ barcode, response });
    return response;
  }

  respond(result: ProductLookupResult): void {
    this.requests.at(-1)?.response.next(result);
  }
}

@Component({
  imports: [BarcodeScanner],
  template: `
    <app-barcode-scanner
      [open]="open()"
      [kcalRemaining]="kcalRemaining()"
      mealLabel="Morgenmad"
      (closed)="closedCount = closedCount + 1"
      (found)="found.push($event)"
      (manualRequested)="manualCount = manualCount + 1"
      (noBarcodeRequested)="noBarcodeCount = noBarcodeCount + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly kcalRemaining = signal<number | null>(500);
  readonly found: FoodItem[] = [];
  closedCount = 0;
  manualCount = 0;
  noBarcodeCount = 0;
}

describe('BarcodeScanner', () => {
  let scanner: FakeBarcodeScannerService;
  let lookup: FakeProductLookupService;
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;

  async function setup(): Promise<void> {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        ...provideComponentTestEnvironment(),
        { provide: BarcodeScannerService, useValue: scanner },
        { provide: ProductLookupService, useValue: lookup },
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await settle();
  }

  /** Lets pending promises (the fake camera) and timers run, then re-renders. */
  async function settle(ms = 0): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    fixture.detectChanges();
  }

  function hint(): string {
    return root.querySelector('.barcode-scanner__hint')?.textContent?.trim() ?? '';
  }

  function dialogs(): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]')).map(
      (dialog) => dialog.getAttribute('aria-label') ?? '',
    );
  }

  function findButton(text: string): HTMLButtonElement | undefined {
    return Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === text,
    );
  }

  function buttonByText(text: string): HTMLButtonElement {
    const button = findButton(text);
    if (!button) {
      throw new Error(`Ingen knap med teksten "${text}"`);
    }
    return button;
  }

  function portionByLabel(label: string): HTMLButtonElement {
    const tile = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.barcode-scanner__portion'),
    ).find(
      (candidate) =>
        candidate.querySelector('.barcode-scanner__portion-label')?.textContent?.trim() === label,
    );
    if (!tile) {
      throw new Error(`Ingen portionsflise med etiketten "${label}"`);
    }
    return tile;
  }

  function statValues(): string[] {
    return Array.from(root.querySelectorAll('.barcode-scanner__stat-value')).map(
      (stat) => stat.textContent?.trim() ?? '',
    );
  }

  function formErrors(): string[] {
    return Array.from(root.querySelectorAll('app-ui-form-error'))
      .map((error) => error.textContent?.trim() ?? '')
      .filter(Boolean);
  }

  function verdict(): HTMLElement | null {
    return root.querySelector<HTMLElement>('.barcode-scanner__verdict');
  }

  function typeInto(ariaLabel: string, text: string): void {
    const field = root.querySelector<HTMLInputElement>(`input[aria-label="${ariaLabel}"]`);
    if (!field) {
      throw new Error(`Intet felt med aria-label "${ariaLabel}"`);
    }
    field.value = text;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submitBarcode(code: string): void {
    typeInto('Stregkode', code);
    buttonByText('Slå op').click();
    fixture.detectChanges();
  }

  /** Native: the camera read `BARCODE` on open; the lookup answers with `result`. */
  async function scanAndRespond(result: ProductLookupResult): Promise<void> {
    await setup();
    lookup.respond(result);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    resetComponentTestStorage();
    scanner = new FakeBarcodeScannerService();
    lookup = new FakeProductLookupService();
  });

  afterEach(() => {
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('in the browser (no camera)', () => {
    beforeEach(() => {
      scanner.canScan = false;
    });

    it('offers typing the barcode instead of scanning', async () => {
      await setup();

      expect(dialogs()).toEqual(['Scan stregkode']);
      expect(hint()).toBe('Kameraet kan ikke bruges her. Indtast stregkodens tal i stedet.');
      expect(findButton('Scan stregkode')).toBeUndefined();
      expect(scanner.scanCalls).toBe(0);
    });

    it('validates 8–14 digits before looking up', async () => {
      await setup();

      submitBarcode('12345');
      expect(formErrors()).toEqual(['Stregkoden skal være 8–14 cifre.']);
      expect(lookup.requests).toHaveLength(0);

      submitBarcode('12345678a');
      expect(lookup.requests).toHaveLength(0);

      submitBarcode(` ${BARCODE} `);
      expect(lookup.requests.map((request) => request.barcode)).toEqual([BARCODE]);
      expect(scanner.recorded).toBe(1);
    });

    it('shows the loading state and then the result of a typed barcode', async () => {
      await setup();
      submitBarcode(BARCODE);

      expect(hint()).toBe('Slår varen op…');
      expect(root.querySelector('app-ui-spinner')).not.toBeNull();
      expect(root.querySelector('input[aria-label="Stregkode"]')).toBeNull();

      lookup.respond({ status: 'found', product: PRODUCT });
      fixture.detectChanges();
      expect(dialogs()).toEqual(['Scan stregkode', 'Proteinbar Choko']);
    });
  });

  it('opens the camera on open and shows the found product at its serving size', async () => {
    await scanAndRespond({ status: 'found', product: PRODUCT });

    expect(scanner.scanCalls).toBe(1);
    expect(lookup.requests.map((request) => request.barcode)).toEqual([BARCODE]);
    expect(scanner.recorded).toBe(1);
    expect(dialogs()).toEqual(['Scan stregkode', 'Proteinbar Choko']);
    expect(root.querySelector('.barcode-scanner__subtitle')?.textContent?.trim()).toBe(
      'Nutrify Select · 50 g',
    );
    expect(portionByLabel('Portion').getAttribute('aria-pressed')).toBe('true');
    expect(
      portionByLabel('Portion').querySelector('.barcode-scanner__portion-sub')?.textContent?.trim(),
    ).toBe('50 g · 200 kcal');
    // The 50 g preset is the serving already, so it isn't repeated.
    expect(() => portionByLabel('50 g')).toThrow();
    expect(statValues()).toEqual(['200', '20', '15', '6']);
    expect(verdict()?.textContent?.trim()).toBe(
      'God proteinkilde – 20 g protein. Du har 300 kcal tilbage bagefter.',
    );
  });

  it('recalculates when the amount changes and logs the scaled item', async () => {
    await scanAndRespond({ status: 'found', product: PRODUCT });

    portionByLabel('200 g').click();
    fixture.detectChanges();
    expect(statValues()).toEqual(['800', '80', '60', '24']);
    expect(verdict()?.classList.contains('barcode-scanner__verdict--negative')).toBe(true);

    typeInto('Mængde i gram', '25');
    expect(statValues()).toEqual(['100', '10', '8', '3']);
    expect(portionByLabel('Portion').getAttribute('aria-pressed')).toBe('false');

    buttonByText('Tilføj').click();
    fixture.detectChanges();

    expect(host.found).toEqual([
      { ...PRODUCT.item, quantity: '25 g', kcal: 100, protein: 10, carbs: 8, fat: 3 },
    ]);
    expect(host.closedCount).toBe(1);
  });

  it('blocks logging an invalid amount', async () => {
    await scanAndRespond({ status: 'found', product: PRODUCT });

    typeInto('Mængde i gram', '0');

    expect(formErrors()).toEqual(['Angiv en mængde mellem 1 og 5000 g.']);
    expect(statValues()).toEqual([]);
    expect(buttonByText('Tilføj').disabled).toBe(true);
  });

  it('says an unknown product was not found and offers the manual form', async () => {
    await scanAndRespond({ status: 'not-found', barcode: BARCODE });

    expect(hint()).toBe('Varen blev ikke fundet.');
    expect(root.querySelector('.barcode-scanner__hint--error')).not.toBeNull();
    expect(dialogs()).toEqual(['Scan stregkode']);
    expect(findButton('Indtast manuelt i stedet')).toBeDefined();

    buttonByText('Varen har ingen stregkode').click();
    fixture.detectChanges();

    expect(host.noBarcodeCount).toBe(1);
    expect(host.closedCount).toBe(1);
    expect(host.found).toEqual([]);
  });

  it('shows a network error and retries the same barcode', async () => {
    await scanAndRespond({ status: 'error', barcode: BARCODE });

    expect(hint()).toBe('Vi kunne ikke slå varen op. Tjek din internetforbindelse, og prøv igen.');
    buttonByText('Prøv igen').click();
    fixture.detectChanges();

    expect(lookup.requests.map((request) => request.barcode)).toEqual([BARCODE, BARCODE]);
    lookup.respond({ status: 'found', product: PRODUCT });
    fixture.detectChanges();
    expect(dialogs()).toEqual(['Scan stregkode', 'Proteinbar Choko']);
  });

  it('explains a denied camera permission and opens the settings', async () => {
    scanner.outcome = { status: 'permission-denied' };
    await setup();

    expect(hint()).toContain('Appen har ikke adgang til kameraet.');
    buttonByText('Åbn indstillinger').click();
    expect(scanner.settingsOpened).toBe(1);
    // The barcode can still be typed.
    expect(root.querySelector('input[aria-label="Stregkode"]')).not.toBeNull();
  });

  it('lets the user scan again when the barcode could not be read', async () => {
    scanner.outcome = { status: 'unreadable' };
    await setup();

    expect(hint()).toBe(
      'Vi kunne ikke læse stregkoden. Prøv igen med bedre lys, eller indtast tallene herunder.',
    );
    scanner.outcome = { status: 'scanned', barcode: BARCODE };
    buttonByText('Scan stregkode').click();
    await settle();

    expect(scanner.scanCalls).toBe(2);
    expect(lookup.requests).toHaveLength(1);
  });

  it('tells the user when the Android scanner module is being installed', async () => {
    scanner.outcome = { status: 'module-installing' };
    await setup();

    expect(hint()).toBe('Stregkodescanneren hentes fra Google Play. Prøv igen om et øjeblik.');
  });

  it('closes without logging when the camera is cancelled', async () => {
    scanner.outcome = { status: 'cancelled' };
    await setup();

    expect(host.closedCount).toBe(1);
    expect(host.found).toEqual([]);
    expect(lookup.requests).toHaveLength(0);
  });

  it('ignores a lookup that answers after the scanner was closed', async () => {
    await setup();

    host.open.set(false);
    fixture.detectChanges();
    lookup.respond({ status: 'found', product: PRODUCT });
    fixture.detectChanges();

    expect(dialogs()).toEqual([]);
    expect(host.found).toEqual([]);
  });

  it('opens the camera again after "Scan igen" on the result sheet', async () => {
    await scanAndRespond({ status: 'found', product: PRODUCT });

    buttonByText('Scan igen').click();
    fixture.detectChanges();
    expect(dialogs()).toEqual(['Scan stregkode']);
    expect(scanner.scanCalls).toBe(1);

    await settle(RETRY_DELAY_MS);
    expect(scanner.scanCalls).toBe(2);
  });

  it('emits manualRequested and noBarcodeRequested and closes', async () => {
    scanner.canScan = false;
    await setup();

    buttonByText('Indtast manuelt i stedet').click();
    fixture.detectChanges();
    expect(host.manualCount).toBe(1);
    expect(host.closedCount).toBe(1);

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    buttonByText('Varen har ingen stregkode').click();
    fixture.detectChanges();
    expect(host.noBarcodeCount).toBe(1);
    expect(host.closedCount).toBe(2);
  });

  it('gives focus back to the element that opened the scanner', async () => {
    scanner.canScan = false;
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    await setup();
    expect(document.activeElement).toBe(root.querySelector('.barcode-scanner__overlay'));

    host.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('closes via Escape only while the overlay is on top, and from the close button', async () => {
    await setup();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closedCount).toBe(1);

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();
    await settle();
    lookup.respond({ status: 'found', product: PRODUCT });
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
    expect(dialogs()).toEqual(['Scan stregkode']);

    root.querySelector<HTMLButtonElement>('.barcode-scanner__header button')?.click();
    expect(host.closedCount).toBe(2);
  });

  it('keeps Tab inside the overlay while it is on top', async () => {
    scanner.canScan = false;
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    await setup();
    const overlay = root.querySelector<HTMLElement>('.barcode-scanner__overlay');
    const focusable = Array.from(
      overlay?.querySelectorAll<HTMLElement>(
        'button, input, [href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );
    const first = focusable.at(0);
    const last = focusable.at(-1);
    expect(first).toBeDefined();
    expect(last).toBeDefined();

    last?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(last);

    outside.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    outside.remove();
  });

  it('leaves Tab to the sheet when a sheet lies on top of the scanner', async () => {
    await scanAndRespond({ status: 'found', product: PRODUCT });

    root.querySelector<HTMLElement>('.ui-sheet__panel button')?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fixture.detectChanges();

    const overlay = root.querySelector<HTMLElement>('.barcode-scanner__overlay');
    expect(overlay?.contains(document.activeElement)).toBe(false);
  });
});

describe('buildScanVerdict', () => {
  const item: FoodItem = { ...TEST_FOOD };

  it('matches the design copy for the three cases', () => {
    const t = TestBed.runInInjectionContext(() => injectTranslate());
    expect(buildScanVerdict(t, 150, item)).toEqual({
      tone: 'negative',
      text: 'Den skubber dig 60 kcal over dagens mål. Overvej en halv, eller gem den til efter træning.',
    });
    expect(buildScanVerdict(t, 500, item)).toEqual({
      tone: 'positive',
      text: 'God proteinkilde – 20 g protein. Du har 290 kcal tilbage bagefter.',
    });
    expect(buildScanVerdict(t, 500, { ...item, protein: 10 })).toEqual({
      tone: 'neutral',
      text: 'Passer fint ind. 290 kcal tilbage bagefter.',
    });
  });
});
