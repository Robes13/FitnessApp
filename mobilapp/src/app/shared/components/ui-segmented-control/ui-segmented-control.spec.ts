import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SegmentOption, UiSegmentedControl } from './ui-segmented-control';

const CHOICES: readonly SegmentOption<boolean>[] = [
  { value: true, label: 'Ja tak' },
  { value: false, label: 'Nej tak' },
];

@Component({
  imports: [UiSegmentedControl],
  template: `
    <app-ui-segmented-control [options]="options" [(value)]="value" ariaLabel="Notifikationer" />
  `,
})
class Host {
  readonly options = CHOICES;
  readonly value = signal<boolean | null>(null);
}

describe('UiSegmentedControl', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const group = root.querySelector('app-ui-segmented-control') as HTMLElement;
    const buttons = () => Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const knob = group.querySelector('.ui-segmented-control__knob') as HTMLElement;
    return { fixture, host: fixture.componentInstance, group, buttons, knob };
  }

  it('renders a radiogroup with one radio per option and no selection', async () => {
    const { group, buttons, knob } = await setup();

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Notifikationer');
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Ja tak', 'Nej tak']);
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false']);
    expect(knob.classList.contains('ui-segmented-control__knob--visible')).toBe(false);
    expect(group.style.getPropertyValue('--segment-count')).toBe('2');
  });

  it('selects an option on click and updates the two-way value', async () => {
    const { fixture, host, buttons, knob, group } = await setup();

    buttons()[1]?.click();
    await fixture.whenStable();

    expect(host.value()).toBe(false);
    expect(buttons().map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'true']);
    expect(buttons()[1]?.classList.contains('ui-segmented-control__option--selected')).toBe(true);
    expect(knob.classList.contains('ui-segmented-control__knob--visible')).toBe(true);
    expect(group.style.getPropertyValue('--segment-index')).toBe('1');
  });

  it('reflects a value set from the outside', async () => {
    const { fixture, host, buttons, group } = await setup();

    host.value.set(true);
    await fixture.whenStable();

    expect(buttons()[0]?.getAttribute('aria-checked')).toBe('true');
    expect(group.style.getPropertyValue('--segment-index')).toBe('0');
  });

  it('moves the selection with the arrow keys and wraps around', async () => {
    const { fixture, host, group } = await setup();

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(host.value()).toBe(true);

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(host.value()).toBe(false);

    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(host.value()).toBe(true);
  });

  it('keeps only the selected segment in the tab order', async () => {
    const { fixture, host, buttons } = await setup();

    expect(buttons().map((b) => b.tabIndex)).toEqual([0, -1]);

    host.value.set(false);
    await fixture.whenStable();

    expect(buttons().map((b) => b.tabIndex)).toEqual([-1, 0]);
  });
});
