import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { UiEmptyState } from '../../../../shared/components/ui-empty-state/ui-empty-state';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { WeightChart } from '../../components/weight-chart/weight-chart';
import { WeightEditSheet } from '../../components/weight-edit-sheet/weight-edit-sheet';
import { WeightLogList } from '../../components/weight-log-list/weight-log-list';
import { WeightRulerInput } from '../../components/weight-ruler-input/weight-ruler-input';
import { WeightScaleScene } from '../../components/weight-scale-scene/weight-scale-scene';
import { WeightViewService } from '../../services/weight-view';

/** How long the button shows "Saved ✓" after a weigh-in. */
const SAVED_LABEL_MS = 1400;
/** How long the pupils follow the direction the weight was changed in. */
const LOOK_DURATION_MS = 900;

const SAVE_LABEL_KEY = 'weight.page.save';
const SAVED_LABEL_KEY = 'weight.page.saved';

/**
 * The weight screen: record today's weight on the bathroom scale, save the weigh-in and see the trend.
 *
 * All derived logic and the API actions live in `WeightViewService`, which the page itself
 * provides, so the draft and the selected range belong to the screen. The page starts the actions
 * and holds the two short-lived animation states: "Saved ✓" on the button and the figure's gaze,
 * which follows the direction the weight was changed in.
 *
 * While the weigh-ins or the profile load, a spinner replaces the screen; if one fails, a message
 * and "Prøv igen". A second weigh-in the same day opens the overwrite question (an inline sheet).
 */
@Component({
  selector: 'app-weight-page',
  imports: [
    TranslatePipe,
    UiButton,
    UiChip,
    UiEmptyState,
    UiFormError,
    UiSheet,
    UiSpinner,
    WeightChart,
    WeightEditSheet,
    WeightLogList,
    WeightRulerInput,
    WeightScaleScene,
  ],
  templateUrl: './weight-page.html',
  styleUrl: './weight-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [WeightViewService],
  host: { class: 'weight-page' },
})
export class WeightPage {
  protected readonly view = inject(WeightViewService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  private readonly saved = signal(false);
  private readonly lookDirectionState = signal(0);
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private lookTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isSaved = this.saved.asReadonly();
  protected readonly lookDirection = this.lookDirectionState.asReadonly();
  protected readonly saveLabel = computed(() =>
    this.t(this.saved() ? SAVED_LABEL_KEY : SAVE_LABEL_KEY),
  );
  protected readonly deltaClass = computed(
    () => `weight-page__tile-value--${this.view.deltaTone()}`,
  );

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearTimer(this.savedTimer);
      this.clearTimer(this.lookTimer);
    });
  }

  /** The ruler and its −/+ buttons: set the draft and let the gaze follow the direction. */
  protected onDraftChange(kg: number): void {
    const direction = Math.sign(kg - this.view.draftKg()) || this.lookDirectionState();
    this.view.setDraftKg(kg);
    this.look(direction);
  }

  protected save(): void {
    this.run(this.view.save(), () => this.showSaved());
  }

  protected confirmOverwrite(): void {
    this.run(this.view.confirmOverwrite(), () => this.showSaved());
  }

  protected saveEdit(kg: number): void {
    this.run(this.view.saveEdit(kg));
  }

  protected removeEditing(): void {
    this.run(this.view.removeEditing());
  }

  protected retryLoad(): void {
    this.run(this.view.retryLoad());
  }

  /**
   * The view handles the errors of its actions, so `done` only runs on success. The finite action
   * runs to the end even when the tab is left, so the API's answer (and the goal reload after it)
   * always reaches the stores – only the page's own `done` is skipped then.
   */
  private run(action: Observable<void>, done?: () => void): void {
    action.subscribe(() => {
      if (!this.destroyRef.destroyed) {
        done?.();
      }
    });
  }

  private showSaved(): void {
    this.saved.set(true);
    this.clearTimer(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.saved.set(false);
      this.savedTimer = null;
    }, SAVED_LABEL_MS);
  }

  private look(direction: number): void {
    this.lookDirectionState.set(direction);
    this.clearTimer(this.lookTimer);
    this.lookTimer = setTimeout(() => {
      this.lookDirectionState.set(0);
      this.lookTimer = null;
    }, LOOK_DURATION_MS);
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
