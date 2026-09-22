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
/** Retter og bundter logges som én portion, præcis som i designets `logRecipe`. */
const LOG_QUANTITY = '1 portion';
const NOT_FOUND_MESSAGE = 'Vi kunne ikke finde den her opskrift.';
const NO_CONTENTS_MESSAGE = 'Der er ingen varer i samlingen endnu.';

interface RecipeStat {
  readonly label: string;
  readonly value: string;
  readonly accent: boolean;
}

/**
 * Opskriftsskærmen. Rute-id'et kan være en ret, en hel samling (`col:<id>`) eller en løs
 * vare – `CollectionsViewService.detailFor` slår alle tre op, og siden viser en tom
 * tilstand, hvis intet passer. "Log X kcal" lægger posten i dagens log og skifter til Mad.
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
   * Bindes fra ruten via `withComponentInputBinding()`. Feltnavnet skal være det samme som
   * `ROUTE_PARAM.RECIPE_ID`. Angular kræver en statisk analyserbar alias, så konstanten kan
   * ikke bruges her – specen binder de to sammen, så et navneskift fanges af testene.
   */
  readonly recipeId = input('');

  private readonly view = inject(CollectionsViewService);
  private readonly foodLog = inject(FoodLogService);
  private readonly router = inject(Router);

  protected readonly detail = computed(() => this.view.detailFor(this.recipeId()));
  /** Valgt måltid – starter på rettens eget og nulstilles, når en ny ret åbnes. */
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
