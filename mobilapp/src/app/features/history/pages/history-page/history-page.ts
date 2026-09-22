import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { HistoryEntry, HistoryFilterId } from '../../models/history';
import { HistoryService } from '../../services/history';

/** Stregtykkelsen på gen-log-ikonet i SVG-enheder (designets `stroke-width="2.4"`). */
const RELOG_ICON_STROKE_WIDTH = 2.4;

/**
 * Historik-fanen: overskrift, filter-chips og posterne grupperet pr. dag.
 * Al data og al tilstand ligger i `HistoryService`, som siden selv leverer.
 */
@Component({
  selector: 'app-history-page',
  templateUrl: './history-page.html',
  styleUrl: './history-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiChip, UiEmptyState, UiIcon, UiIconButton],
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
