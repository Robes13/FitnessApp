import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { NewCollectionInput } from '../../../../core/models/food';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { NewCollectionSheet } from '../../components/new-collection-sheet/new-collection-sheet';
import { CollectionEntry, CollectionsViewService } from '../../services/collections-view';

/**
 * The collections screen: the user's collections and the "New collection" sheet. The rows are
 * built by `CollectionsViewService`; the page owns the sheet and the running create, which
 * closes the sheet only once the API has saved the collection (a failure shows in the sheet).
 */
@Component({
  selector: 'app-collections-page',
  imports: [
    NewCollectionSheet,
    TranslatePipe,
    UiButton,
    UiEmptyState,
    UiIcon,
    UiIconButton,
    UiSpinner,
  ],
  templateUrl: './collections-page.html',
  styleUrl: './collections-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'collections-page' },
})
export class CollectionsPage {
  protected readonly view = inject(CollectionsViewService);
  private readonly collections = inject(CollectionsService);
  private readonly router = inject(Router);
  private readonly t = injectTranslate();

  protected readonly sheetOpen = signal(false);
  /** The create is running – the sheet's button shows a spinner and ignores taps. */
  protected readonly saving = signal(false);
  private readonly failureKey = signal<string | null>(null);
  protected readonly saveError = computed(() => {
    const key = this.failureKey();
    return key === null ? null : this.t(key);
  });

  protected openSheet(): void {
    this.failureKey.set(null);
    this.sheetOpen.set(true);
  }

  protected open(entry: CollectionEntry): void {
    void this.router.navigateByUrl(APP_PATH.recipe(entry.id));
  }

  /** Not cancelled when the page closes, so a save is never lost halfway. */
  protected onCreated(input: NewCollectionInput): void {
    if (this.saving()) {
      return;
    }
    this.saving.set(true);
    this.failureKey.set(null);
    this.collections
      .create(input)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.sheetOpen.set(false),
        error: (error: unknown) => this.failureKey.set(toApiError(error).messageKey),
      });
  }
}
