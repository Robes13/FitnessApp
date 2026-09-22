import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LoggedFood } from '../../../../core/models/food';
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
  imports: [UiIcon],
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
}
