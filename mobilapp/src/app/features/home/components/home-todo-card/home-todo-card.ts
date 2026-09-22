import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { HomeTodo } from '../../services/home-summary';

/**
 * "Næste skridt" – det første uafsluttede gøremål som et orange gradient-kort, der fører
 * direkte til Vægt eller Mad (med måltidet valgt via query-parameteren).
 */
@Component({
  selector: 'app-home-todo-card',
  imports: [RouterLink, UiIcon],
  templateUrl: './home-todo-card.html',
  styleUrl: './home-todo-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-todo-card' },
})
export class HomeTodoCard {
  readonly todo = input.required<HomeTodo>();
  /** `'1 / 3'` eller `'Kun én'`. */
  readonly countLabel = input.required<string>();
}
