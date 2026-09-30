import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MEALS } from '../../../../core/constants/meals';
import { MealId } from '../../../../core/models/meal';
import { injectTranslate } from '../../../../core/services/language/translate';

const DEFAULT_ARIA_LABEL_KEY = 'collections.mealPicker.defaultAriaLabel';

/**
 * The arrow keys move the selection like in a native radio group. The grid has two columns,
 * so up/down jumps a whole row (±2) and left/right moves one place.
 */
const KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -2,
  ArrowDown: 2,
};

/**
 * The four meals as a 2×2 grid (the design's `newColMeals` and `recipeMealPicks`).
 * Used both in "New collection" (`filled`: filled background) and on the recipe screen (transparent).
 */
@Component({
  selector: 'app-meal-picker',
  imports: [TranslatePipe],
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
  /** Unselected buttons get a faint fill instead of being transparent. */
  readonly filled = input(false, { transform: booleanAttribute });
  /** The group's accessible name – "Vælg måltid" when not given. */
  readonly ariaLabel = input<string>();

  private readonly t = injectTranslate();
  protected readonly meals = MEALS;
  protected readonly groupLabel = computed(
    () => this.ariaLabel() ?? this.t(DEFAULT_ARIA_LABEL_KEY),
  );

  private readonly options = viewChildren<ElementRef<HTMLButtonElement>>('option');

  protected select(meal: MealId): void {
    this.value.set(meal);
  }

  /** Only the selected meal is in the tab order – the rest are reached with the arrow keys. */
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
