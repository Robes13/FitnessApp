import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideComponentTestEnvironment } from '../../../core/testing/test-providers';
import { UiConfirmSheet } from './ui-confirm-sheet';

@Component({
  imports: [UiConfirmSheet],
  template: `
    <app-ui-confirm-sheet
      [open]="open()"
      titleKey="food.removeSheet.title"
      accentKey="food.removeSheet.titleAccent"
      bodyKey="food.removeSheet.body"
      [bodyParams]="{ foodName: 'Skyr' }"
      confirmKey="food.removeSheet.confirm"
      cancelKey="food.removeSheet.cancel"
      [busy]="busy()"
      [errorMessage]="error()"
      (confirmed)="confirms = confirms + 1"
      (closed)="closes = closes + 1"
    />
  `,
})
class Host {
  readonly open = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  confirms = 0;
  closes = 0;
}

describe('UiConfirmSheet', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function button(index: number): HTMLButtonElement | undefined {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.ui-confirm-sheet__actions button',
      ),
    )[index];
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: provideComponentTestEnvironment(),
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('asks with the translated texts and has no close button', () => {
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.ui-sheet__title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Fjern vare?',
    );
    expect(root.querySelector('.ui-confirm-sheet__body')?.textContent?.trim()).toBe(
      '«Skyr» bliver fjernet fra dagens log.',
    );
    expect(root.querySelector('.ui-sheet__close')).toBeNull();
    expect(button(0)?.textContent?.trim()).toBe('Ja, fjern varen');
    expect(button(1)?.textContent?.trim()).toBe('Annuller');
  });

  it('emits confirmed and closed from its two buttons', () => {
    button(0)?.click();
    button(1)?.click();

    expect(host.confirms).toBe(1);
    expect(host.closes).toBe(1);
  });

  it('never closes from the scrim', async () => {
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.ui-sheet__scrim')?.click();
    await fixture.whenStable();

    expect(host.closes).toBe(0);
  });

  it('cancels on Escape – Android back – but not while busy', async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closes).toBe(1);

    host.busy.set(true);
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(host.closes).toBe(1);
    expect(host.confirms).toBe(0);
  });

  it('shows the error message only when there is one', async () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-ui-form-error')).toBeNull();

    host.error.set('Ingen forbindelse.');
    await fixture.whenStable();

    expect(root.querySelector('app-ui-form-error')?.textContent?.trim()).toBe('Ingen forbindelse.');
  });

  it('shows a spinner and blocks both buttons while busy', async () => {
    host.busy.set(true);
    await fixture.whenStable();

    button(0)?.click();

    expect(button(0)?.getAttribute('aria-busy')).toBe('true');
    expect(button(1)?.disabled).toBe(true);
    expect(host.confirms).toBe(0);
  });
});
