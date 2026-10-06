import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { MEALS } from '../../../../core/constants/meals';
import { MealId } from '../../../../core/models/meal';
import { injectTranslate } from '../../../../core/services/language/translate';

const DEFAULT_ARIA_LABEL_KEY = 'collections.mealPicker.defaultAriaLabel';

/**
 * The four meals as a 2×2 grid (the design's `recipeMealPicks`) – the meal a collection is logged
 * under. Each option is a native radio inside a label, so the browser provides the keyboard handling.
 */
@Component({
  selector: 'app-meal-picker',
  imports: [TranslatePipe],
  templateUrl: './meal-picker.html',
  styleUrl: './meal-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'meal-picker' },
})
export class MealPicker {
  readonly value = model.required<MealId>();
  /** The group's accessible name – "Vælg måltid" when not given. */
  readonly ariaLabel = input<string>();

  private readonly t = injectTranslate();
  protected readonly meals = MEALS;
  protected readonly groupLabel = computed(
    () => this.ariaLabel() ?? this.t(DEFAULT_ARIA_LABEL_KEY),
  );
}
