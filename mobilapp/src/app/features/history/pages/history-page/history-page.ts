import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { HistoryEntry } from '../../models/history';
import { HistoryService, RelogState } from '../../services/history';

/** The stroke width on the re-log icon in SVG units (the design's `stroke-width="2.4"`). */
const RELOG_ICON_STROKE_WIDTH = 2.4;

/** How close to the bottom of the list (px) scrolling asks for the next page. */
export const HISTORY_LOAD_MORE_THRESHOLD_PX = 400;

/**
 * The History tab: heading, filter chips and the entries grouped by day. Opening it loads the
 * first page; scrolling near the bottom loads the next.
 * All data and all state live in `HistoryService`, which the page provides itself.
 */
@Component({
  selector: 'app-history-page',
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslatePipe,
    UiButton,
    UiChip,
    UiEmptyState,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiSpinner,
  ],
  providers: [HistoryService],
  host: { class: 'history-page' },
})
export class HistoryPage {
  protected readonly history = inject(HistoryService);

  protected readonly relogIconStrokeWidth = RELOG_ICON_STROKE_WIDTH;
  /**
   * When any visible row has a re-log button, the rows without one keep its space free, so all
   * values end in the same column.
   */
  protected readonly reservesRelogSpace = computed(() =>
    this.history.groups().some((group) => group.entries.some((entry) => entry.food)),
  );

  constructor() {
    this.history.loadMore();
  }

  // ponytail: assumes a page (50 rows) overflows the screen, so the next page is only asked for on
  // scroll; check the height after each page if a screen ever fits 50 rows.
  protected onScroll(list: HTMLElement): void {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - HISTORY_LOAD_MORE_THRESHOLD_PX) {
      this.history.loadMore();
    }
  }

  protected relog(entry: HistoryEntry): void {
    this.history.relog(entry);
  }

  protected relogLabel(entry: HistoryEntry): string {
    return this.history.relogLabel(entry);
  }

  protected relogState(entry: HistoryEntry): RelogState | null {
    return this.history.relogState(entry);
  }
}
