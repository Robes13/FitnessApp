import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

/**
 * The confirmation before logging out. The sheet has no close button – as in the design
 * the choice is made with "Ja, log mig ud" or "Annuller", and an accidental tap on the
 * scrim doesn't log out.
 */
@Component({
  selector: 'app-profile-logout-sheet',
  imports: [UiButton, UiIcon, UiSheet],
  templateUrl: './profile-logout-sheet.html',
  styleUrl: './profile-logout-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileLogoutSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
