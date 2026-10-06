import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiButton } from '../ui-button/ui-button';
import { UiFormError } from '../ui-form-error/ui-form-error';
import { UiSheet } from '../ui-sheet/ui-sheet';

/**
 * A confirmation before something is deleted ("Slet samling?", "Fjern vare?"). Like the logout
 * confirmation, the sheet has no close button: the choice is made with the red confirm button or
 * the cancel button, so an accidental tap on the scrim never deletes anything. The sheet doesn't
 * delete itself – it emits `confirmed`, and while the parent's call runs (`busy`) the confirm
 * button shows a spinner and cancel is off. All texts are translation keys.
 */
@Component({
  selector: 'app-ui-confirm-sheet',
  imports: [TranslatePipe, UiButton, UiFormError, UiSheet],
  templateUrl: './ui-confirm-sheet.html',
  styleUrl: './ui-confirm-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiConfirmSheet {
  readonly open = input.required<boolean>();
  readonly titleKey = input.required<string>();
  /** The red part of the title, e.g. `samling?`. */
  readonly accentKey = input.required<string>();
  readonly bodyKey = input.required<string>();
  /** Params for `bodyKey`, e.g. `{ name }`. */
  readonly bodyParams = input<Readonly<Record<string, string>>>({});
  readonly confirmKey = input.required<string>();
  readonly cancelKey = input.required<string>();
  /** The confirmed action is running. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** Why the confirmed action failed – already translated. */
  readonly errorMessage = input<string | null>(null);

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  /** `UiButton`'s `loading` doesn't stop this element's own click binding, so busy is checked here. */
  protected confirm(): void {
    if (!this.busy()) {
      this.confirmed.emit();
    }
  }
}
