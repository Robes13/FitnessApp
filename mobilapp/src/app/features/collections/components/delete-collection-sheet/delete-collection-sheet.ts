import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

/**
 * The confirmation before a user collection is deleted. Like the logout confirmation, the sheet
 * has no close button: the choice is made with "Ja, slet samlingen" or "Annuller", so an
 * accidental tap on the scrim never deletes anything. The sheet doesn't delete itself – it
 * emits `confirmed`, and the page calls `CollectionsService.remove()`.
 */
@Component({
  selector: 'app-delete-collection-sheet',
  imports: [TranslatePipe, UiButton, UiSheet],
  templateUrl: './delete-collection-sheet.html',
  styleUrl: './delete-collection-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteCollectionSheet {
  readonly open = input.required<boolean>();
  /** The collection's name, shown in the question. */
  readonly name = input.required<string>();

  readonly closed = output<void>();
  readonly confirmed = output<void>();
}
