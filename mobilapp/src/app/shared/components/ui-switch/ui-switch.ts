import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';

/**
 * Toggle switch 48×28 with a 22 px thumb (Light mode, Notifications). Controlled: it always
 * shows `checked`, and a tap only emits `checkedChange` with the new value – the parent decides.
 * A save that is refused or fails before the next render therefore can't leave it showing the
 * wrong state. The button is the interactive part and carries `role="switch"`, `aria-checked`
 * and `aria-label`.
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
  readonly checked = input(false);
  readonly ariaLabel = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  readonly checkedChange = output<boolean>();

  protected toggle(): void {
    if (!this.disabled()) {
      this.checkedChange.emit(!this.checked());
    }
  }
}
