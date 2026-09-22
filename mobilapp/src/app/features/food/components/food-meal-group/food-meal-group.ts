import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LoggedFood } from '../../../../core/models/food';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { MealGroupView } from '../../services/food-view';

/**
 * Én måltidsgruppe på Mad-skærmen (designets `sc-for list="{{ meals }}"`): overskrift med
 * kalorier, de loggede varer og linket "+ Tilføj til …".
 *
 * Gruppen er ren præsentation – siden ejer loggen og handler på `edit`, `removed` og `add`.
 * En tom gruppe viser kun tilføj-linket, præcis som i designet.
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

  /** Tryk på varens navn: redigér portionen. */
  readonly edit = output<LoggedFood>();
  readonly removed = output<LoggedFood>();
  /** "+ Tilføj til <måltid>". */
  readonly add = output<void>();
}
