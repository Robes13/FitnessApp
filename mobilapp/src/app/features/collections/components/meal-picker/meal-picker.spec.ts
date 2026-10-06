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
    const picker = (fixture.nativeElement as HTMLElement).querySelector(
      'app-meal-picker',
    ) as HTMLElement;
    const options = () =>
      Array.from(picker.querySelectorAll<HTMLLabelElement>('.meal-picker__option'));
    const radios = () => Array.from(picker.querySelectorAll<HTMLInputElement>('input[type=radio]'));
    return { fixture, host: fixture.componentInstance, picker, options, radios };
  }

  it('renders the four meals as native radios in a labelled group', async () => {
    const { picker, options, radios } = await setup();
    const group = picker.querySelector('.meal-picker__grid') as HTMLElement;

    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Hører under');
    expect(options().map((option) => option.textContent?.trim())).toEqual([
      'Morgenmad',
      'Frokost',
      'Aftensmad',
      'Snacks',
    ]);
    expect(new Set(radios().map((radio) => radio.name)).size).toBe(1);
  });

  it('checks the selected meal and follows the bound value', async () => {
    const { fixture, host, radios } = await setup();

    expect(radios().map((radio) => radio.checked)).toEqual([true, false, false, false]);

    host.meal.set('aften');
    await fixture.whenStable();

    expect(radios().map((radio) => radio.checked)).toEqual([false, false, true, false]);
  });

  it('selects the meal that was tapped', async () => {
    const { fixture, host, options, radios } = await setup();

    options()[3]?.click();
    await fixture.whenStable();

    expect(host.meal()).toBe('snack');
    expect(radios().map((radio) => radio.checked)).toEqual([false, false, false, true]);
    expect(options()[3]?.classList).toContain('meal-picker__option--selected');
  });
});
