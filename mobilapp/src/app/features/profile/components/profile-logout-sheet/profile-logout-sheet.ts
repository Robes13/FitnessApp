import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

/**
 * Bekræftelsen før log ud. Arket har ingen luk-knap – som i designet træffes valget med
 * "Ja, log mig ud" eller "Annuller", og et utilsigtet tryk på scrimmen logger ikke ud.
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
