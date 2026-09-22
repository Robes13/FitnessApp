import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';
import { UiIconButton } from '../ui-icon-button/ui-icon-button';

export type PageHeaderBackIcon = 'chevron-left' | 'close';

const DEFAULT_BACK_LABEL = 'Tilbage';

/**
 * Sidehoved til undersider (Opskrift, Profil): rund tilbage-knap til venstre, centreret
 * uppercase-titel og en højre plads til en handling (`[headerAction]`). Er pladsen tom,
 * fylder den det samme som tilbage-knappen, så titlen forbliver centreret.
 *
 * Komponenten lægger selv sidens vandrette padding på, fordi den står uden for
 * scroll-området.
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
  readonly backIcon = input<PageHeaderBackIcon>('chevron-left');
  readonly backLabel = input(DEFAULT_BACK_LABEL);
  readonly hideBack = input(false, { transform: booleanAttribute });

  readonly back = output<void>();

  protected onBack(): void {
    this.back.emit();
  }
}
