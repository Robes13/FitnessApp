import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { HomeDayRow } from '../../services/home-summary';

/**
 * "Åbn mere": the last 30 days as a list in a sheet, newest first – day, kcal against the
 * goal and the macros (spec 5.4/5.5). The parent owns `open`.
 */
@Component({
  selector: 'app-home-month-sheet',
  imports: [UiSheet, TranslatePipe],
  templateUrl: './home-month-sheet.html',
  styleUrl: './home-month-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-month-sheet' },
})
export class HomeMonthSheet {
  readonly open = input.required<boolean>();
  readonly rows = input.required<readonly HomeDayRow[]>();

  readonly closed = output<void>();
}
