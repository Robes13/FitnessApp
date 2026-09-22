import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';

const DEFAULT_BACK_LABEL = 'Tilbage';

/**
 * Page header for subpages (Recipe, Profile): round back button on the left, centered
 * uppercase title and a right-hand slot for an action (`[headerAction]`). When the slot is
 * empty, it takes up the same space as the back button, so the title stays centered.
 *
 * The component applies the page's horizontal padding itself, because it sits outside
 * the scroll area.
 */
@Component({
  selector: 'app-ui-page-header',
  imports: [UiIcon, UiIconButton],
  templateUrl: './ui-page-header.html',
  styleUrl: './ui-page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ui-page-header' },
})
export class UiPageHeader {
  readonly title = input.required<string>();
  readonly backLabel = input(DEFAULT_BACK_LABEL);
  readonly hideBack = input(false, { transform: booleanAttribute });

  readonly back = output<void>();

  protected onBack(): void {
    this.back.emit();
  }
}
