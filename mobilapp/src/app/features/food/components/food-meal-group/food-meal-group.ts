import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LoggedFood } from '../../../../core/models/food';
import { injectTranslate } from '../../../../core/services/language/translate';
import { formatInteger } from '../../../../core/utils/date-format';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { MealGroupView } from '../../services/food-view';

/**
 * A meal group on the Mad screen (the design's `sc-for list="{{ meals }}"`): a heading with
 * calories, the logged foods and the "+ Add to …" link.
 *
 * The group is pure presentation – the page owns the log and acts on `edit`, `removed` and `add`.
 * An empty group shows only the add link, exactly as in the design.
 */
@Component({
  selector: 'app-food-meal-group',
  imports: [TranslatePipe, UiIcon],
  templateUrl: './food-meal-group.html',
  styleUrl: './food-meal-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'food-meal-group' },
})
export class FoodMealGroup {
  readonly group = input.required<MealGroupView>();

  /** Tapping the food's name: edit the portion. */
  readonly edit = output<LoggedFood>();
  readonly removed = output<LoggedFood>();
  /** "+ Add to <meal>". */
  readonly add = output<void>();

  private readonly t = injectTranslate();

  /** Whole kcal (`'1.600'`): the log holds the API's exact values. */
  protected kcal(entry: LoggedFood): string {
    return formatInteger(entry.kcal);
  }

  protected editLabel(entry: LoggedFood): string {
    return this.t('food.mealGroup.editItem', { foodName: entry.name });
  }

  protected removeLabel(entry: LoggedFood): string {
    return this.t('food.mealGroup.removeItem', { foodName: entry.name });
  }
}
