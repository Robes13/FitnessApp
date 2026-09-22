import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { MealId } from '../../../../core/models/meal';
import { FoodLogService } from '../../../../core/services/food-log';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiPageHeader } from '../../../../shared/components/ui-page-header/ui-page-header';
import { MealPicker } from '../../components/meal-picker/meal-picker';
import { CollectionsViewService } from '../../services/collections-view';

const DEFAULT_MEAL: MealId = 'morgen';
/** Dishes and bundles are logged as one portion, exactly like the design's `logRecipe`. */
const LOG_QUANTITY = '1 portion';
const NOT_FOUND_MESSAGE = 'Vi kunne ikke finde den her opskrift.';
const NO_CONTENTS_MESSAGE = 'Der er ingen varer i samlingen endnu.';

interface RecipeStat {
  readonly label: string;
  readonly value: string;
  readonly accent: boolean;
}

/**
 * The recipe screen. The route id can be a dish, a whole collection (`col:<id>`) or a standalone
 * food – `CollectionsViewService.detailFor` looks up all three, and the page shows an empty
 * state if nothing matches. "Log X kcal" puts the entry in today's log and switches to Mad.
 */
@Component({
  selector: 'app-recipe-page',
  imports: [MealPicker, UiButton, UiEmptyState, UiIcon, UiPageHeader],
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
  private readonly foodLog = inject(FoodLogService);
  private readonly router = inject(Router);

  protected readonly detail = computed(() => this.view.detailFor(this.recipeId()));
  /** Selected meal – starts on the dish's own meal and resets when a new dish is opened. */
  protected readonly meal = linkedSignal<MealId>(() => this.detail()?.meal ?? DEFAULT_MEAL);
  protected readonly notFoundMessage = NOT_FOUND_MESSAGE;
  protected readonly noContentsMessage = NO_CONTENTS_MESSAGE;

  protected readonly stats = computed<readonly RecipeStat[]>(() => {
    const macros = this.detail()?.macros;
    if (!macros) {
      return [];
    }
    return [
      { label: 'Kalorier', value: `${macros.kcal}`, accent: true },
      { label: 'Protein', value: `${macros.protein} g`, accent: false },
      { label: 'Kulhydrat', value: `${macros.carbs} g`, accent: false },
      { label: 'Fedt', value: `${macros.fat} g`, accent: false },
    ];
  });

  protected readonly toneClass = computed(() => {
    const tone = this.detail()?.tone;
    return tone ? `recipe-page__hero--${tone}` : '';
  });

  protected back(): void {
    void this.router.navigateByUrl(APP_PATH.COLLECTIONS);
  }

  protected log(): void {
    const detail = this.detail();
    if (!detail) {
      return;
    }
    this.foodLog.add(
      { id: detail.id, name: detail.title, quantity: LOG_QUANTITY, ...detail.macros },
      this.meal(),
    );
    void this.router.navigateByUrl(APP_PATH.FOOD);
  }
}
