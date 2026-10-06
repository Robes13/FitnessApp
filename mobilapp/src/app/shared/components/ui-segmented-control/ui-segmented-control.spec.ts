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
    const radios = () =>
      Array.from(group.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    const labels = () =>
      Array.from(group.querySelectorAll<HTMLElement>('.ui-segmented-control__option'));
    const knob = group.querySelector('.ui-segmented-control__knob') as HTMLElement;
    return { fixture, host: fixture.componentInstance, group, radios, labels, knob };
  }

  it('renders a radiogroup with one native radio per option and no selection', async () => {
    const { group, radios, labels, knob } = await setup();

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Notifikationer');
    expect(labels().map((label) => label.textContent?.trim())).toEqual(['Ja tak', 'Nej tak']);
    expect(radios().map((radio) => radio.checked)).toEqual([false, false]);
    expect(new Set(radios().map((radio) => radio.name)).size).toBe(1);
    expect(knob.classList.contains('ui-segmented-control__knob--visible')).toBe(false);
    expect(group.style.getPropertyValue('--segment-count')).toBe('2');
  });

  it('selects an option on click and updates the two-way value', async () => {
    const { fixture, host, radios, labels, knob, group } = await setup();

    radios()[1]?.click();
    await fixture.whenStable();

    expect(host.value()).toBe(false);
    expect(radios().map((radio) => radio.checked)).toEqual([false, true]);
    expect(labels()[1]?.classList.contains('ui-segmented-control__option--selected')).toBe(true);
    expect(knob.classList.contains('ui-segmented-control__knob--visible')).toBe(true);
    expect(group.style.getPropertyValue('--segment-index')).toBe('1');
  });

  it('reflects a value set from the outside', async () => {
    const { fixture, host, radios, group } = await setup();

    host.value.set(true);
    await fixture.whenStable();

    expect(radios()[0]?.checked).toBe(true);
    expect(group.style.getPropertyValue('--segment-index')).toBe('0');
  });
});
