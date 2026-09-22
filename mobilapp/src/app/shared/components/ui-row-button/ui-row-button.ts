import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiIcon } from '../ui-icon/ui-icon';

export type RowButtonValueTone = 'default' | 'muted' | 'accent';
export type RowButtonDensity = 'regular' | 'compact';

/**
 * Række med label til venstre, værdi + chevron til højre (Profil → "Min plan",
 * opsummeringen i opret-flowet). Bruges som attribut på en `<button>`.
 */
@Component({
  selector: 'button[app-ui-row-button]',
  imports: [UiIcon],
  templateUrl: './ui-row-button.html',
  styleUrl: './ui-row-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-row-button',
    type: 'button',
    '[class]': 'hostClass()',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class UiRowButton {
  readonly label = input.required<string>();
  /** Erstatter rækkens oplæste navn, fx "Ret vægt" på opsummeringens rækker. */
  readonly ariaLabel = input<string | null>(null);
  readonly value = input('');
  readonly valueTone = input<RowButtonValueTone>('default');
  readonly density = input<RowButtonDensity>('regular');
  readonly chevron = input(true);
  readonly divider = input(true);

  protected readonly hostClass = computed(() =>
    this.divider()
      ? `ui-row-button--${this.density()} ui-row-button--divider`
      : `ui-row-button--${this.density()}`,
  );
  protected readonly valueClass = computed(() => `ui-row-button__value--${this.valueTone()}`);
}
