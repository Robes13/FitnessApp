import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';

/**
 * Skydeknap 48×28 med 22 px knop (Lys tilstand, Notifikationer). Tilstanden er en
 * two-way `model`, så `[(checked)]` virker. Knappen er den interaktive del og bærer
 * `role="switch"`, `aria-checked` og `aria-label`.
 */
@Component({
  selector: 'app-ui-switch',
  templateUrl: './ui-switch.html',
  styleUrl: './ui-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-switch',
    '[class.ui-switch--on]': 'checked()',
  },
})
export class UiSwitch {
  readonly checked = model(false);
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected toggle(): void {
    if (this.disabled()) {
      return;
    }
    this.checked.update((on) => !on);
  }
}
