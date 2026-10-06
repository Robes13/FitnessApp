import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, finalize } from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { CollectionItem, NewCollectionInput } from '../../../../core/models/food';
import { MealId } from '../../../../core/models/meal';
import { formatGrams, formatInteger } from '../../../../core/utils/date-format';
import { CollectionsService } from '../../../../core/services/collections/collections';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { formatQuantity } from '../../../../core/utils/quantity';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiConfirmSheet } from '../../../../shared/components/ui-confirm-sheet/ui-confirm-sheet';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiPageHeader } from '../../../../shared/components/ui-page-header/ui-page-header';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { MealPicker } from '../../components/meal-picker/meal-picker';
import { NewCollectionSheet } from '../../components/new-collection-sheet/new-collection-sheet';
import { CollectionsViewService } from '../../services/collections-view';

const DEFAULT_MEAL: MealId = 'morgen';

interface RecipeStat {
  readonly label: string;
  readonly value: string;
  readonly accent: boolean;
}

/**
 * The recipe screen of one collection (`col:<id>`): its macros and items, "Log X kcal" under the
 * chosen meal (spec 3.2) and – via the header's pencil and the button at the bottom – edit and
 * delete (spec 4.1/4.2). One action runs at a time (`pending`); a failure is shown above the log
 * button. A failed edit closes the sheet: the collection has been fetched again, so a new
 * attempt starts from what the API kept and never adds an item twice.
 */
@Component({
  selector: 'app-recipe-page',
  imports: [
    MealPicker,
    NewCollectionSheet,
    TranslatePipe,
    UiButton,
    UiConfirmSheet,
    UiEmptyState,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiPageHeader,
    UiSpinner,
  ],
  templateUrl: './recipe-page.html',
  styleUrl: './recipe-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'recipe-page' },
})
export class RecipePage {
  /**
   * Bound from the route via `withComponentInputBinding()`. The field name must be the same as
   * `ROUTE_PARAM.RECIPE_ID`. Angular requires a statically analyzable alias, so the constant can't
   * be used here – the spec ties the two together, so a name change is caught by the tests.
   */
  readonly recipeId = input('');

  protected readonly view = inject(CollectionsViewService);
  private readonly collections = inject(CollectionsService);
  private readonly router = inject(Router);
  private readonly t = injectTranslate();

  protected readonly status = this.view.status;
  /** Only once both stores are ready – until the foods are loaded every item would show 0 kcal. */
  protected readonly detail = computed(() =>
    this.status() === 'ready' ? this.view.detailFor(this.recipeId()) : null,
  );
  protected readonly collection = computed(() =>
    this.status() === 'ready' ? this.view.collectionFor(this.recipeId()) : null,
  );
  /** The meal "Log som spist under" logs under. */
  protected readonly meal = signal<MealId>(DEFAULT_MEAL);
  protected readonly editOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  /** A log, save or delete is running – further taps are ignored. */
  protected readonly pending = signal(false);
  /** Translation key of the last failed action. */
  protected readonly errorKey = signal<string | null>(null);

  protected readonly stats = computed<readonly RecipeStat[]>(() => {
    const macros = this.detail()?.macros;
    if (!macros) {
      return [];
    }
    const grams = (value: number): string => `${formatGrams(value)} ${this.t('common.unit.g')}`;
    return [
      {
        label: this.t('collections.recipePage.calories'),
        value: formatInteger(macros.kcal),
        accent: true,
      },
      {
        label: this.t('collections.recipePage.protein'),
        value: grams(macros.protein),
        accent: false,
      },
      { label: this.t('collections.recipePage.carbs'), value: grams(macros.carbs), accent: false },
      { label: this.t('collections.recipePage.fat'), value: grams(macros.fat), accent: false },
    ];
  });
  protected readonly logKcal = computed(() => formatInteger(this.detail()?.macros.kcal ?? 0));

  /** `'2 portioner'` – the unit in the active language. */
  protected quantity(line: CollectionItem): string {
    return formatQuantity(this.t, line.quantity);
  }

  protected back(): void {
    void this.router.navigateByUrl(APP_PATH.COLLECTIONS);
  }

  protected openEdit(): void {
    this.errorKey.set(null);
    this.editOpen.set(true);
  }

  protected openDelete(): void {
    this.errorKey.set(null);
    this.deleteOpen.set(true);
  }

  /** The sheet closes either way – after an error the collection shows what the API kept. */
  protected onUpdated(input: NewCollectionInput): void {
    this.runOnCollection(
      (id) => this.collections.update(id, input),
      () => this.editOpen.set(false),
      () => this.editOpen.set(false),
    );
  }

  /** Back to the list once the API has deleted it; a failure closes the confirmation. */
  protected delete(): void {
    this.runOnCollection(
      (id) => this.collections.remove(id),
      () => void this.router.navigateByUrl(APP_PATH.COLLECTIONS),
      () => this.deleteOpen.set(false),
    );
  }

  /** One food log row per item under the chosen meal (P13), then on to Mad. */
  protected log(): void {
    this.runOnCollection(
      (id) => this.collections.log(id, this.meal()),
      () => void this.router.navigateByUrl(APP_PATH.FOOD),
    );
  }

  /** Runs one action at a time. Not cancelled when the page closes, so a save is never lost. */
  private runOnCollection(
    action: (id: string) => Observable<void>,
    done: () => void,
    failed?: () => void,
  ): void {
    const collection = this.collection();
    if (!collection || this.pending()) {
      return;
    }
    this.pending.set(true);
    this.errorKey.set(null);
    action(collection.id)
      .pipe(finalize(() => this.pending.set(false)))
      .subscribe({
        next: done,
        error: (error: unknown) => {
          this.errorKey.set(toApiError(error).messageKey);
          failed?.();
        },
      });
  }
}
