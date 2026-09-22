import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { MEALS } from '../../../../core/constants/meals';
import { MealId } from '../../../../core/models/meal';

const DEFAULT_ARIA_LABEL = 'Vælg måltid';

/**
 * Piletasterne flytter valget som i en native radiogruppe. Gitteret har to kolonner,
 * så op/ned springer en hel række (±2) og venstre/højre én plads.
 */
const KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -2,
  ArrowDown: 2,
};

/**
 * De fire måltider som 2×2-gitter (designets `newColMeals` og `recipeMealPicks`).
 * Bruges både i "Ny samling" (`filled`: udfyldt bund) og på opskriftsskærmen (gennemsigtig).
 */
@Component({
  selector: 'app-meal-picker',
  templateUrl: './meal-picker.html',
  styleUrl: './meal-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'meal-picker',
    '(keydown)': 'onKeydown($event)',
  },
})
export class MealPicker {
  readonly value = model.required<MealId>();
  /** Ikke-valgte knapper får en svag flade i stedet for at være gennemsigtige. */
  readonly filled = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input(DEFAULT_ARIA_LABEL);

  protected readonly meals = MEALS;

  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');

  protected select(meal: MealId): void {
    this.value.set(meal);
  }

  /** Kun det valgte måltid er i tab-rækkefølgen – resten nås med piletasterne. */
  protected tabIndexFor(meal: MealId): number {
    return meal === this.value() ? 0 : -1;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const delta = KEY_DELTAS[event.key];
    if (delta === undefined) {
      return;
    }
    const count = this.meals.length;
    const current = this.meals.findIndex((meal) => meal.id === this.value());
    event.preventDefault();
    const next = current < 0 ? 0 : (current + delta + count) % count;
    const meal = this.meals[next];
    if (meal === undefined) {
      return;
    }
    this.value.set(meal.id);
    this.options()[next]?.nativeElement.focus();
  }
}
