import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

const DELETE_BODY_KEY = 'profile.deleteAccountSheet.body';

/**
 * The confirmation before deleting the account. Same pattern as `ProfileLogoutSheet`: no
 * close button, and neither the scrim nor Escape closes it, so an accidental tap can never
 * delete anything. The deletion itself happens on the profile page, which passes `busy` while
 * the API is called and `errorMessage` if it failed. Withdrawing the consent (spec 9.2-3b)
 * deletes the account too, and asks with the same sheet and its own `bodyKey`.
 */
@Component({
  selector: 'app-profile-delete-account-sheet',
  imports: [TranslatePipe, UiButton, UiFormError, UiIcon, UiSheet],
  templateUrl: './profile-delete-account-sheet.html',
  styleUrl: './profile-delete-account-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDeleteAccountSheet {
  readonly open = input.required<boolean>();
  /** The deletion is in progress. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** Why the deletion failed – already translated. */
  readonly errorMessage = input<string | null>(null);
  /** The explanation's translation key; `null` = the account deletion's own text. */
  readonly bodyKey = input<string | null>(null);

  protected readonly body = computed(() => this.bodyKey() ?? DELETE_BODY_KEY);

  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
