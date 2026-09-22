import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { NewCollectionSheet } from '../../components/new-collection-sheet/new-collection-sheet';
import { CollectionEntry, CollectionsViewService } from '../../services/collections-view';

const DEFAULT_MEAL: MealId = 'morgen';
const EMPTY_MESSAGE = 'Der er ingen retter eller varer i den her samling endnu.';

/**
 * Samlingsskærmen: ét filter og én liste med brugerens samlinger, deres varer og
 * designets retter. Rækkerne bygges af `CollectionsViewService`; siden holder kun styr på
 * det valgte filter og på "Ny samling"-arket.
 */
@Component({
  selector: 'app-collections-page',
  imports: [NewCollectionSheet, UiChip, UiEmptyState, UiIcon, UiIconButton],
  templateUrl: './collections-page.html',
  styleUrl: './collections-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'collections-page' },
})
export class CollectionsPage {
  private readonly view = inject(CollectionsViewService);
  private readonly collections = inject(CollectionsService);
  private readonly router = inject(Router);

  /** Id på den valgte faste samling – `null` er "Alle". */
  protected readonly selectedId = signal<string | null>(null);
  protected readonly sheetOpen = signal(false);
  protected readonly emptyMessage = EMPTY_MESSAGE;

  protected readonly chips = computed(() => this.view.chips());
  protected readonly entries = computed(() => this.view.entriesFor(this.selectedId()));
  /** Arket åbner på det måltid, filteret peger på (designets `openNewCol`). */
  protected readonly defaultMeal = computed<MealId>(() => {
    const id = this.selectedId();
    return id === null ? DEFAULT_MEAL : (this.collections.collectionById(id)?.meal ?? DEFAULT_MEAL);
  });

  protected select(id: string | null): void {
    this.selectedId.set(id);
  }

  protected toneClass(entry: CollectionEntry): string {
    return `collections-page__card--${entry.tone}`;
  }

  protected open(entry: CollectionEntry): void {
    void this.router.navigateByUrl(APP_PATH.recipe(entry.id));
  }

  /** Opretter samlingen og slår over på det filter, den hører under. */
  protected onCreated(input: NewCollectionInput): void {
    const created = this.collections.create(input);
    const base = this.collections.baseCollections().find((c) => c.meal === created.meal);
    this.selectedId.set(base?.id ?? null);
    this.sheetOpen.set(false);
  }
}
