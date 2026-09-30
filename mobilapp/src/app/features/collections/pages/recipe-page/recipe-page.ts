import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { concatMap, finalize, from, toArray } from 'rxjs';
import { API_ERROR_MESSAGE_KEY } from '../../../../core/constants/api';
import { APP_PATH } from '../../../../core/constants/app-route';
import { NewCollectionInput } from '../../../../core/models/food';
import { formatGrams } from '../../../../core/utils/date-format';
import { MealId } from '../../../../core/models/meal';
import { CollectionsService } from '../../../../core/services/collections/collections';
import {
  DuplicateCustomFoodNameError,
  FoodLogService,
} from '../../../../core/services/food-log/food-log';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiConfirmSheet } from '../../../../shared/components/ui-confirm-sheet/ui-confirm-sheet';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiPageHeader } from '../../../../shared/components/ui-page-header/ui-page-header';
import { MealPicker } from '../../components/meal-picker/meal-picker';
import { NewCollectionSheet } from '../../components/new-collection-sheet/new-collection-sheet';
import { CollectionsViewService } from '../../services/collections-view';

const DEFAULT_MEAL: MealId = 'morgen';
const NOT_FOUND_MESSAGE_KEY = 'collections.recipePage.notFound';
const NO_CONTENTS_MESSAGE_KEY = 'collections.recipePage.noContents';

interface RecipeStat {
  readonly label: string;
  readonly value: string;
  readonly accent: boolean;
}

/**
 * The recipe screen. The route id can be a dish, a whole collection (`col:<id>`) or a standalone
 * food – `CollectionsViewService.detailFor` looks up all three, and the page shows an empty
 * state if nothing matches. "Log X kcal" puts a collection's items in today's log (one row each,
 * P13) and switches to Mad; dishes and loose foods don't exist before wave 3 removes them.
 *
 * A user collection (`col:<id>`) can also be edited – the header's pencil reopens
 * `NewCollectionSheet` prefilled – and deleted after a confirmation, which returns to the list.
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

  private readonly view = inject(CollectionsViewService);
  private readonly collections = inject(CollectionsService);
  private readonly foodLog = inject(FoodLogService);
  private readonly router = inject(Router);
  private readonly t = injectTranslate();

  protected readonly detail = computed(() => this.view.detailFor(this.recipeId()));
  /** Selected meal – starts on the dish's own meal and resets when a new dish is opened. */
  protected readonly meal = linkedSignal<MealId>(() => this.detail()?.meal ?? DEFAULT_MEAL);
  /** The user collection behind the id – only those can be edited and deleted. */
  protected readonly collection = computed(() => this.view.editableCollectionFor(this.recipeId()));
  protected readonly editOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  /** The log is running – further taps are ignored. */
  protected readonly logging = signal(false);
  /** Translation key of the last failed log. */
  protected readonly logError = signal<string | null>(null);
  protected readonly notFoundMessageKey = NOT_FOUND_MESSAGE_KEY;
  protected readonly noContentsMessageKey = NO_CONTENTS_MESSAGE_KEY;

  protected readonly stats = computed<readonly RecipeStat[]>(() => {
    const macros = this.detail()?.macros;
    if (!macros) {
      return [];
    }
    const grams = (value: number): string => `${formatGrams(value)} ${this.t('common.unit.g')}`;
    return [
      {
        label: this.t('collections.recipePage.calories'),
        value: `${Math.round(macros.kcal)}`,
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

  protected readonly toneClass = computed(() => {
    const tone = this.detail()?.tone;
    return tone ? `recipe-page__hero--${tone}` : '';
  });

  protected back(): void {
    void this.router.navigateByUrl(APP_PATH.COLLECTIONS);
  }

  /** The sheet has already rejected a duplicate name, so `update()` won't throw here. */
  protected onUpdated(input: NewCollectionInput): void {
    const collection = this.collection();
    if (collection) {
      this.collections.update(collection.id, input);
    }
    this.editOpen.set(false);
  }

  protected delete(): void {
    const collection = this.collection();
    if (collection) {
      this.collections.remove(collection.id);
    }
    this.deleteOpen.set(false);
    void this.router.navigateByUrl(APP_PATH.COLLECTIONS);
  }

  /**
   * ponytail: one `add()` per item until `CollectionsService.log()` (wave 3) logs them in one
   * call; a failure midway keeps the rows logged so far.
   */
  protected log(): void {
    const items = this.collection()?.items ?? [];
    if (items.length === 0 || this.logging()) {
      return;
    }
    const meal = this.meal();
    this.logging.set(true);
    this.logError.set(null);
    from(items)
      .pipe(
        concatMap((item) => this.foodLog.add(item, meal)),
        toArray(),
        finalize(() => this.logging.set(false)),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(APP_PATH.FOOD),
        // A 409 only when another device just created an item's name – the generic text will do.
        error: (error: unknown) =>
          this.logError.set(
            error instanceof DuplicateCustomFoodNameError
              ? API_ERROR_MESSAGE_KEY.REQUEST_FAILED
              : toApiError(error).messageKey,
          ),
      });
  }
}
