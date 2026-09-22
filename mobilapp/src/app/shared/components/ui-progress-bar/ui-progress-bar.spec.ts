import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiProgressBar, clampFraction } from './ui-progress-bar';

@Component({
  imports: [UiProgressBar],
  template: `<app-ui-progress-bar [value]="value()" [tone]="tone()" thickness="thin" />`,
})
class Host {
  readonly value = signal(0.5);
  readonly tone = signal<'accent' | 'inverse'>('accent');
}

describe('UiProgressBar', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('app-ui-progress-bar') as HTMLElement;
    const fill = bar.querySelector('.ui-progress-bar__fill') as HTMLElement;
    return { fixture, bar, fill };
  }

  it('clamps fractions to 0..1', () => {
    expect(clampFraction(0.4)).toBe(0.4);
    expect(clampFraction(-2)).toBe(0);
    expect(clampFraction(7)).toBe(1);
    expect(clampFraction(Number.NaN)).toBe(0);
  });

  it('renders the value as a percentage width with progressbar semantics', async () => {
    const { bar, fill } = await setup();

    expect(fill.style.width).toBe('50%');
    expect(bar.getAttribute('role')).toBe('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.classList.contains('ui-progress-bar--thin')).toBe(true);
    expect(fill.classList.contains('ui-progress-bar__fill--accent')).toBe(true);
  });

  it('never exceeds 100 % and switches tone classes', async () => {
    const { fixture, bar, fill } = await setup();

    fixture.componentInstance.value.set(3);
    fixture.componentInstance.tone.set('inverse');
    await fixture.whenStable();

    expect(fill.style.width).toBe('100%');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.classList.contains('ui-progress-bar--inverse')).toBe(true);
    expect(fill.classList.contains('ui-progress-bar__fill--inverse')).toBe(true);
  });
});
