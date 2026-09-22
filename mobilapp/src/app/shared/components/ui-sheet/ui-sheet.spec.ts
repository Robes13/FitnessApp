import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiSheet } from './ui-sheet';

@Component({
  imports: [UiSheet],
  template: `
    <app-ui-sheet
      [open]="open()"
      title="Ny"
      titleAccent="samling"
      [hideClose]="hideClose()"
      layer="sheet-high"
      maxHeight="medium"
      column
      (closed)="onClosed()"
    >
      <span class="leading" sheetLeading>Mærke</span>
      <button class="extra" sheetHeaderExtra type="button">Ekstra</button>
      <p class="body">Indhold</p>
      <button class="footer" sheetFooter type="button">Opret samling</button>
    </app-ui-sheet>
  `,
})
class Host {
  readonly open = signal(false);
  readonly hideClose = signal(false);
  closedCount = 0;

  onClosed(): void {
    this.closedCount++;
  }
}

@Component({
  imports: [UiSheet],
  template: `
    <app-ui-sheet [open]="lowerOpen()" title="Nederst" (closed)="onLowerClosed()">
      <p>Nederste ark</p>
    </app-ui-sheet>
    <app-ui-sheet [open]="upperOpen()" title="Øverst" (closed)="onUpperClosed()">
      <p>Øverste ark</p>
    </app-ui-sheet>
  `,
})
class StackHost {
  readonly lowerOpen = signal(true);
  readonly upperOpen = signal(true);
  lowerClosed = 0;
  upperClosed = 0;

  onLowerClosed(): void {
    this.lowerClosed++;
  }

  onUpperClosed(): void {
    this.upperClosed++;
  }
}

@Component({
  imports: [UiSheet],
  template: `
    <app-ui-sheet [open]="true" (closed)="closedCount = closedCount + 1">
      <span class="badge" sheetTitle>Ukendt vare</span>
      <p>Indhold</p>
    </app-ui-sheet>
  `,
})
class TitleSlotHost {
  closedCount = 0;
}

@Component({
  imports: [UiSheet],
  template: `
    <app-ui-sheet
      [open]="true"
      title="Profil"
      titleAccent="billede"
      titleAccentJoined
      titleSize="lg"
      titleAccentTone="negative"
    >
      <p>Indhold</p>
    </app-ui-sheet>
  `,
})
class TitleVariantsHost {}

@Component({
  imports: [UiSheet],
  template: `
    <button class="trigger" type="button" (click)="open.set(true)">Åbn</button>
    <app-ui-sheet [open]="open()" title="Ny" titleAccent="samling" (closed)="open.set(false)">
      <button class="one" type="button">Et</button>
      <button class="two" type="button">To</button>
    </app-ui-sheet>
  `,
})
class TriggerHost {
  readonly open = signal(false);
}

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function pressTab(shiftKey = false): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true }));
}

describe('UiSheet', () => {
  async function setup(open = true) {
    TestBed.configureTestingModule({ imports: [Host, StackHost] });
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.open.set(open);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      root,
      dialog: () => root.querySelector<HTMLElement>('[role="dialog"]'),
      scrim: () => root.querySelector<HTMLElement>('.ui-sheet__scrim'),
      closeButton: () => root.querySelector<HTMLButtonElement>('.ui-sheet__close'),
    };
  }

  it('renders nothing while closed', async () => {
    const { root, dialog } = await setup(false);

    expect(dialog()).toBeNull();
    expect(root.querySelector('.ui-sheet__scrim')).toBeNull();
  });

  it('renders the dialog with title, accent, slots and layer when open', async () => {
    const { root, dialog, scrim, closeButton } = await setup();
    const panel = dialog();

    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.getAttribute('aria-label')).toBe('Ny samling');
    expect(root.querySelector('.ui-sheet__title')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Ny samling',
    );
    expect(root.querySelector('.ui-sheet__title-accent')?.textContent).toBe('samling');
    expect(scrim()?.classList.contains('ui-sheet__scrim--sheet-high')).toBe(true);
    expect(closeButton()?.getAttribute('aria-label')).toBe('Luk');
    expect(root.querySelector('.ui-sheet__leading .leading')?.textContent).toBe('Mærke');
    expect(root.querySelector('.ui-sheet__header-extra .extra')).not.toBeNull();
    expect(root.querySelector('.ui-sheet__body .body')?.textContent).toBe('Indhold');
    expect(root.querySelector('.ui-sheet__footer .footer')).not.toBeNull();
  });

  it('keeps the panel class alongside the max-height and column modifiers', async () => {
    const { root, dialog } = await setup();
    const panel = dialog();

    expect(panel?.classList.contains('ui-sheet__panel')).toBe(true);
    expect(panel?.classList.contains('ui-sheet__panel--medium')).toBe(true);
    expect(
      root.querySelector('.ui-sheet__body')?.classList.contains('ui-sheet__body--column'),
    ).toBe(true);
  });

  it('places the leading slot before the header in the DOM', async () => {
    const { dialog } = await setup();
    const children = Array.from(dialog()?.children ?? []).map((child) => child.className);

    expect(children.indexOf('ui-sheet__leading')).toBe(0);
    expect(children.indexOf('ui-sheet__header')).toBe(1);
  });

  it('moves focus into the panel when it opens', async () => {
    const { dialog } = await setup();

    expect(document.activeElement).toBe(dialog());
  });

  it('gives focus back to the element that opened it when it closes', async () => {
    TestBed.configureTestingModule({ imports: [TriggerHost] });
    const fixture = TestBed.createComponent(TriggerHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const trigger = root.querySelector<HTMLButtonElement>('.trigger');

    trigger?.focus();
    trigger?.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('[role="dialog"]'));

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab and Shift+Tab inside the panel', async () => {
    const { root, dialog } = await setup();
    const first = root.querySelector<HTMLButtonElement>('.extra');
    const last = root.querySelector<HTMLButtonElement>('.footer');

    last?.focus();
    pressTab();
    expect(document.activeElement).toBe(first);

    pressTab(true);
    expect(document.activeElement).toBe(last);

    dialog()?.focus();
    pressTab(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus back into the panel when it sits outside', async () => {
    const { root } = await setup();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    pressTab();

    expect(document.activeElement).toBe(root.querySelector('.extra'));
    outside.remove();
  });

  it('emits closed from the close button', async () => {
    const { host, closeButton } = await setup();

    closeButton()?.click();

    expect(host.closedCount).toBe(1);
  });

  it('emits closed when the scrim itself is clicked, but not for clicks inside the panel', async () => {
    const { host, scrim, dialog } = await setup();

    dialog()?.click();
    expect(host.closedCount).toBe(0);

    scrim()?.click();
    expect(host.closedCount).toBe(1);
  });

  it('emits closed on Escape only while open', async () => {
    const { fixture, host } = await setup(false);

    pressEscape();
    expect(host.closedCount).toBe(0);

    host.open.set(true);
    await fixture.whenStable();
    pressEscape();
    expect(host.closedCount).toBe(1);
  });

  it('is not dismissible when hideClose is set', async () => {
    const { fixture, host, scrim, closeButton } = await setup();

    host.hideClose.set(true);
    await fixture.whenStable();

    expect(closeButton()).toBeNull();
    scrim()?.click();
    pressEscape();
    expect(host.closedCount).toBe(0);
  });

  it('renders the sheetTitle slot instead of an empty heading when there is no title', async () => {
    TestBed.configureTestingModule({ imports: [TitleSlotHost] });
    const fixture = TestBed.createComponent(TitleSlotHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('.ui-sheet__title')).toBeNull();
    expect(root.querySelector('.ui-sheet__title-slot .badge')?.textContent).toBe('Ukendt vare');
    expect(root.querySelector('[role="dialog"]')?.hasAttribute('aria-label')).toBe(false);
    expect(root.querySelector('.ui-sheet__close')).not.toBeNull();
  });

  it('joins title and accent without a space and applies size and tone modifiers', async () => {
    TestBed.configureTestingModule({ imports: [TitleVariantsHost] });
    const fixture = TestBed.createComponent(TitleVariantsHost);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const heading = root.querySelector<HTMLElement>('.ui-sheet__title');
    const accent = root.querySelector<HTMLElement>('.ui-sheet__title-accent');

    expect(heading?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Profilbillede');
    expect(heading?.classList.contains('ui-sheet__title--lg')).toBe(true);
    expect(accent?.classList.contains('ui-sheet__title-accent--negative')).toBe(true);
    expect(root.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Profilbillede');
  });

  it('closes only the topmost sheet on Escape when sheets are stacked', async () => {
    TestBed.configureTestingModule({ imports: [StackHost] });
    const fixture = TestBed.createComponent(StackHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;

    pressEscape();
    expect(host.upperClosed).toBe(1);
    expect(host.lowerClosed).toBe(0);

    host.upperOpen.set(false);
    await fixture.whenStable();
    pressEscape();
    expect(host.lowerClosed).toBe(1);
    expect(host.upperClosed).toBe(1);
  });
});
