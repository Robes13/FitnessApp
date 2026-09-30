import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { HistoryEntry, HistoryFilterId } from '../../models/history';
import { HistoryService } from '../../services/history';

/** The stroke width on the re-log icon in SVG units (the design's `stroke-width="2.4"`). */
const RELOG_ICON_STROKE_WIDTH = 2.4;

/**
 * The History tab: heading, filter chips and the entries grouped by day.
 * All data and all state live in `HistoryService`, which the page provides itself.
 */
@Component({
  selector: 'app-history-page',
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, UiChip, UiEmptyState, UiIcon, UiIconButton],
  providers: [HistoryService],
  host: { class: 'history-page' },
})
export class HistoryPage {
  private readonly history = inject(HistoryService);

  protected readonly relogIconStrokeWidth = RELOG_ICON_STROKE_WIDTH;
  protected readonly filters = this.history.filters;
  protected readonly filter = this.history.filter;
  protected readonly groups = this.history.groups;
  protected readonly isEmpty = this.history.isEmpty;
  /**
   * When any visible row has a re-log button, the rows without one keep its space free, so all
   * values end in the same column.
   */
  protected readonly reservesRelogSpace = computed(() =>
    this.groups().some((group) => group.entries.some((entry) => entry.food)),
  );

  protected selectFilter(filter: HistoryFilterId): void {
    this.history.setFilter(filter);
  }

  protected relog(entry: HistoryEntry): void {
    this.history.relog(entry);
  }

  protected relogLabel(entry: HistoryEntry): string {
    return this.history.relogLabel(entry);
  }

  protected isRelogged(entry: HistoryEntry): boolean {
    return this.history.isRelogged(entry);
  }
}
