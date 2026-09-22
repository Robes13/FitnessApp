import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MealId } from '../../../../core/models/meal';
import { MealPicker } from './meal-picker';

@Component({
  imports: [MealPicker],
  template: `<app-meal-picker [(value)]="meal" ariaLabel="Hører under" />`,
})
class Host {
  readonly meal = signal<MealId>('morgen');
}

describe('MealPicker', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const picker = root.querySelector('app-meal-picker') as HTMLElement;
    const options = () =>
      Array.from(picker.querySelectorAll<HTMLButtonElement>('.meal-picker__option'));
    async function press(key: string): Promise<void> {
      picker.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await fixture.whenStable();
    }
    return { fixture, host: fixture.componentInstance, picker, options, press };
  }

  it('renders the four meals as a radiogroup', async () => {
    const { picker, options } = await setup();
    const group = picker.querySelector('.meal-picker__grid') as HTMLElement;

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Hører under');
    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
  });

  it('keeps only the selected meal in the tab order', async () => {
    const { fixture, host, options } = await setup();

    expect(options().map((option) => option.tabIndex)).toEqual([0, -1, -1, -1]);

    host.meal.set('aften');
    await fixture.whenStable();

    expect(options().map((option) => option.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('moves one place sideways and a whole row up or down', async () => {
    const { host, press } = await setup();

    await press('ArrowRight');
    expect(host.meal()).toBe('frokost');

    await press('ArrowDown');
    expect(host.meal()).toBe('snack');

    await press('ArrowLeft');
    expect(host.meal()).toBe('aften');

    await press('ArrowUp');
    expect(host.meal()).toBe('morgen');
  });

  it('wraps around both ends of the grid', async () => {
    const { host, press } = await setup();

    await press('ArrowLeft');
    expect(host.meal()).toBe('snack');

    await press('ArrowRight');
    expect(host.meal()).toBe('morgen');

    await press('ArrowUp');
    expect(host.meal()).toBe('aften');
  });

  it('moves focus to the meal the arrow keys land on', async () => {
    const { options, press } = await setup();

    await press('ArrowRight');

    expect(document.activeElement).toBe(options()[1]);
  });

  it('ignores keys that are not arrows', async () => {
    const { host, press } = await setup();

    await press('Enter');
    await press('a');

    expect(host.meal()).toBe('morgen');
  });
});
