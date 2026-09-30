import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

/**
 * The confirmation before deleting the account. Same pattern as `ProfileLogoutSheet`: no
 * close button, and neither the scrim nor Escape closes it, so an accidental tap can never
 * delete anything. The deletion itself happens on the profile page.
 */
@Component({
  selector: 'app-profile-delete-account-sheet',
  imports: [TranslatePipe, UiButton, UiIcon, UiSheet],
  templateUrl: './profile-delete-account-sheet.html',
  styleUrl: './profile-delete-account-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDeleteAccountSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
