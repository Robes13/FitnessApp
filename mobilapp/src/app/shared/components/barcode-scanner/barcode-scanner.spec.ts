import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, map, timer } from 'rxjs';
import { SCANNED_DEMO_ITEM } from '../../../core/constants/demo-data';
import { FoodItem, ScanResult } from '../../../core/models/food';
import { BarcodeScannerService } from '../../../core/services/barcode-scanner';
import { BarcodeScanner, buildScanVerdict } from './barcode-scanner';

/** Designets tempi: start efter 500 ms, linjen ved 700/1500 ms, svar ved 2300 ms, genstart efter 300 ms. */
const START_DELAY_MS = 500;
const SWEEP_SECOND_STEP_MS = 700;
const SWEEP_THIRD_STEP_MS = 1500;
const RETRY_DELAY_MS = 300;

class FakeBarcodeScannerService {
  result: ScanResult = { status: 'found', item: SCANNED_DEMO_ITEM };
  scanCalls = 0;

  scan(): Observable<ScanResult> {
    this.scanCalls += 1;
    return timer(SCAN_MS).pipe(map(() => this.result));
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
      (customSaved)="saved.push($event)"
      (manualRequested)="manualCount = manualCount + 1"
      (noBarcodeRequested)="noBarcodeCount = noBarcodeCount + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly kcalRemaining = signal<number | null>(500);
  readonly found: FoodItem[] = [];
  readonly saved: FoodItem[] = [];
  closedCount = 0;
  manualCount = 0;
  noBarcodeCount = 0;
}

/** Scannerens svartid (`SCAN_DELAY_MS`-tokenets standard). */
const SCAN_MS = 2300;

describe('BarcodeScanner', () => {
  let scanner: FakeBarcodeScannerService;
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let root: HTMLElement;

  function setup(): void {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [{ provide: BarcodeScannerService, useValue: scanner }],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  /** Spoler tiden frem og lader komponenten tegne om. */
  function tick(ms: number): void {
    vi.advanceTimersByTime(ms);
    fixture.detectChanges();
  }

  function hint(): string {
    return root.querySelector('.barcode-scanner__hint')?.textContent?.trim() ?? '';
  }

  function scanLine(): string {
    const frame = root.querySelector<HTMLElement>('.barcode-scanner__frame');
    return frame?.style.getPropertyValue('--scan-line-y') ?? '';
  }

  function dialogs(): string[] {
    return Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]')).map(
      (dialog) => dialog.getAttribute('aria-label') ?? '',
    );
  }

  function buttonByText(text: string): HTMLButtonElement {
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.replace(/\s+/g, ' ').trim() === text,
    );
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

  function portionSub(tile: HTMLElement): string {
    return tile.querySelector('.barcode-scanner__portion-sub')?.textContent?.trim() ?? '';
  }

  function statValues(): string[] {
    return Array.from(root.querySelectorAll('.barcode-scanner__stat-value')).map(
      (stat) => stat.textContent?.trim() ?? '',
    );
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

  /** Åbner og spoler frem til servicen har svaret. */
  function scanToResult(): void {
    tick(START_DELAY_MS + SCAN_MS);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    scanner = new FakeBarcodeScannerService();
  });

  afterEach(() => {
    fixture.destroy();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows the idle scanner and starts the sweep after half a second', () => {
    setup();

    expect(dialogs()).toEqual(['Scan stregkode']);
    expect(hint()).toBe('Hold stregkoden inden for rammen – vi scanner automatisk');
    expect(scanLine()).toBe('50%');
    expect(root.querySelectorAll('.barcode-scanner__bar')).toHaveLength(30);
    expect(scanner.scanCalls).toBe(0);

    tick(START_DELAY_MS);
    expect(scanner.scanCalls).toBe(1);
    expect(hint()).toBe('Læser stregkode…');
    expect(scanLine()).toBe('88%');

    tick(SWEEP_SECOND_STEP_MS);
    expect(scanLine()).toBe('14%');

    tick(SWEEP_THIRD_STEP_MS - SWEEP_SECOND_STEP_MS);
    expect(scanLine()).toBe('62%');
    expect(dialogs()).toEqual(['Scan stregkode']);
  });

  it('opens the result sheet with the found item when the service answers', () => {
    setup();
    scanToResult();

    expect(dialogs()).toEqual(['Scan stregkode', 'Proteinbar Choko']);
    expect(hint()).toBe('Hold stregkoden inden for rammen – vi scanner automatisk');
    expect(root.querySelector('.barcode-scanner__subtitle')?.textContent?.trim()).toBe(
      'Nutrify Select · 55 g',
    );
    expect(statValues()).toEqual(['210', '20', '22', '7']);
    const whole = portionByLabel('1 bar');
    const half = portionByLabel('Halv');
    expect(whole.getAttribute('aria-pressed')).toBe('true');
    expect(portionSub(whole)).toBe('55 g');
    expect(half.getAttribute('aria-pressed')).toBe('false');
    expect(portionSub(half)).toBe('28 g');
    expect(verdict()?.textContent?.trim()).toBe(
      'God proteinkilde – 20 g protein. Du har 290 kcal tilbage bagefter.',
    );
    expect(verdict()?.classList.contains('barcode-scanner__verdict--positive')).toBe(true);
  });

  it('scales macros, quantity and verdict to the chosen portion and emits the scaled item', () => {
    setup();
    scanToResult();

    portionByLabel('Halv').click();
    fixture.detectChanges();

    expect(portionByLabel('Halv').getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.barcode-scanner__subtitle')?.textContent?.trim()).toBe(
      'Nutrify Select · 28 g',
    );
    expect(statValues()).toEqual(['105', '10', '11', '4']);
    expect(verdict()?.textContent?.trim()).toBe('Passer fint ind. 395 kcal tilbage bagefter.');
    expect(verdict()?.classList.contains('barcode-scanner__verdict--positive')).toBe(false);

    buttonByText('Tilføj').click();
    fixture.detectChanges();

    expect(host.found).toEqual([
      {
        ...SCANNED_DEMO_ITEM,
        quantity: '28 g',
        kcal: 105,
        protein: 10,
        carbs: 11,
        fat: 4,
      },
    ]);
    expect(host.closedCount).toBe(1);
  });

  it('warns when the item pushes the day over target and hides the verdict without a budget', () => {
    setup();
    host.kcalRemaining.set(100);
    scanToResult();

    expect(verdict()?.textContent?.trim()).toBe(
      'Den skubber dig 110 kcal over dagens mål. Overvej en halv, eller gem den til efter træning.',
    );
    expect(verdict()?.classList.contains('barcode-scanner__verdict--negative')).toBe(true);

    host.kcalRemaining.set(null);
    fixture.detectChanges();
    expect(verdict()).toBeNull();
  });

  it('opens the unknown sheet and saves a custom item from the form', () => {
    scanner.result = { status: 'unknown' };
    setup();
    scanToResult();

    expect(root.querySelector('.barcode-scanner__badge')?.textContent?.trim()).toBe('Ukendt vare');
    expect(
      root.querySelector('.barcode-scanner__heading')?.textContent?.replace(/\s+/g, ' ').trim(),
    ).toBe('Den kender vi ikke');
    const save = buttonByText('Gem og tilføj');
    expect(save.disabled).toBe(true);

    typeInto('Navn', '  Proteinbar Karamel ');
    expect(save.disabled).toBe(true);

    typeInto('Kalorier', '180');
    expect(save.disabled).toBe(false);

    save.click();
    fixture.detectChanges();

    expect(host.saved).toHaveLength(1);
    expect(host.saved[0]).toMatchObject({
      name: 'Proteinbar Karamel',
      quantity: '1 portion',
      kcal: 180,
      protein: 0,
      carbs: 0,
      fat: 0,
      isCustom: true,
    });
    expect(host.saved[0]?.id).toMatch(/^custom-/);
    expect(host.closedCount).toBe(1);
  });

  it('restarts scanning after "Scan igen" on the result sheet', () => {
    setup();
    scanToResult();
    expect(scanner.scanCalls).toBe(1);

    buttonByText('Scan igen').click();
    fixture.detectChanges();
    expect(dialogs()).toEqual(['Scan stregkode']);
    expect(scanLine()).toBe('50%');

    tick(RETRY_DELAY_MS);
    expect(scanner.scanCalls).toBe(2);
    expect(hint()).toBe('Læser stregkode…');
  });

  it('emits manualRequested and noBarcodeRequested and closes', () => {
    setup();

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

  it('cancels a running scan when closed and starts over when reopened', () => {
    setup();
    tick(START_DELAY_MS + SWEEP_SECOND_STEP_MS);
    expect(scanLine()).toBe('14%');

    host.open.set(false);
    fixture.detectChanges();
    expect(dialogs()).toEqual([]);

    tick(SCAN_MS);
    expect(host.found).toEqual([]);

    host.open.set(true);
    fixture.detectChanges();
    expect(dialogs()).toEqual(['Scan stregkode']);
    expect(scanLine()).toBe('50%');
    expect(hint()).toBe('Hold stregkoden inden for rammen – vi scanner automatisk');

    tick(START_DELAY_MS);
    expect(scanner.scanCalls).toBe(2);
    expect(scanLine()).toBe('88%');
  });

  it('gives focus back to the element that opened the scanner', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    setup();
    expect(document.activeElement).toBe(root.querySelector('.barcode-scanner__overlay'));

    host.open.set(false);
    fixture.detectChanges();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it('closes from the overlay close button and via Escape only while the scanner is on top', () => {
    setup();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.closedCount).toBe(1);

    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();
    scanToResult();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(host.closedCount).toBe(1);
    expect(dialogs()).toEqual(['Scan stregkode']);

    root.querySelector<HTMLButtonElement>('.barcode-scanner__header button')?.click();
    expect(host.closedCount).toBe(2);
  });

  it('holder Tab inde i overlayet, så længe scanneren ligger øverst', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);

    setup();
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

    // Tab fra det sidste element ruller rundt til det første i stedet for ud af overlayet.
    last?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    // Shift+Tab fra det første ruller baglæns til det sidste.
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(last);

    // Fokus uden for overlayet trækkes tilbage ind.
    outside.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);

    outside.remove();
  });

  it('overlader Tab til arket, når et ark ligger ovenpå scanneren', () => {
    setup();
    scanToResult();

    const sheetButton = root.querySelector<HTMLElement>('.ui-sheet__panel button');
    sheetButton?.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    fixture.detectChanges();

    // Scanneren har ikke revet fokus tilbage til kameraoverlayet.
    const overlay = root.querySelector<HTMLElement>('.barcode-scanner__overlay');
    expect(overlay?.contains(document.activeElement)).toBe(false);
  });
});

describe('buildScanVerdict', () => {
  it('matches the design copy for the three cases', () => {
    expect(buildScanVerdict(150, SCANNED_DEMO_ITEM)).toEqual({
      tone: 'negative',
      text: 'Den skubber dig 60 kcal over dagens mål. Overvej en halv, eller gem den til efter træning.',
    });
    expect(buildScanVerdict(500, SCANNED_DEMO_ITEM)).toEqual({
      tone: 'positive',
      text: 'God proteinkilde – 20 g protein. Du har 290 kcal tilbage bagefter.',
    });
    expect(buildScanVerdict(500, { ...SCANNED_DEMO_ITEM, protein: 10 })).toEqual({
      tone: 'neutral',
      text: 'Passer fint ind. 290 kcal tilbage bagefter.',
    });
  });
});
