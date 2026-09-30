import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { HomeTodo } from '../../services/home-summary';

/**
 * "Næste skridt" – the first unfinished to-do, shown as an orange gradient card that
 * links directly to Weight or Food (with the meal selected via the query parameter).
 */
@Component({
  selector: 'app-home-todo-card',
  imports: [RouterLink, UiIcon, TranslatePipe],
  templateUrl: './home-todo-card.html',
  styleUrl: './home-todo-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-todo-card' },
})
export class HomeTodoCard {
  readonly todo = input.required<HomeTodo>();
  /** `'1 / 3'` or `'Kun én'`. */
  readonly countLabel = input.required<string>();
}
