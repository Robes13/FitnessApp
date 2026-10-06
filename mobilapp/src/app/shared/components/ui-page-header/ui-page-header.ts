import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { injectTranslate } from '../../../core/services/language/translate';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';

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
  readonly backLabel = input<string>();

  readonly back = output<void>();

  private readonly t = injectTranslate();
  protected readonly backLabelText = computed(() => this.backLabel() ?? this.t('common.back'));
}
