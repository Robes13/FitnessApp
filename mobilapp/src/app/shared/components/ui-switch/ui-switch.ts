import { ChangeDetectionStrategy, Component, booleanAttribute, input, model } from '@angular/core';

/**
 * Toggle switch 48×28 with a 22 px thumb (Light mode, Notifications). The state is a
 * two-way `model`, so `[(checked)]` works. The button is the interactive part and carries
 * `role="switch"`, `aria-checked` and `aria-label`.
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
