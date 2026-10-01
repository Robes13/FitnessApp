import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { injectTranslate } from '../../../../core/services/language/translate';
import { WEIGHT_MIN_KG } from '../../../../core/constants/nutrition';
import { formatDecimal } from '../../../../core/utils/date-format';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { WeighLogRow } from '../../services/weight-view';
import { WeightRulerInput } from '../weight-ruler-input/weight-ruler-input';

/**
 * Correct or delete a weigh-in. The sheet is open while `row` is set; the parent owns which
 * weigh-in is being edited and performs the save/delete. While `busy`, the running button shows a
 * spinner, the others are off and the sheet can't be closed; `errorMessage` says why it failed.
 *
 * The corrected weight and the "really delete?" step are local drafts that reset whenever
 * another weigh-in is opened (`linkedSignal`).
 */
@Component({
  selector: 'app-weight-edit-sheet',
  imports: [TranslatePipe, UiButton, UiFormError, UiSheet, WeightRulerInput],
  templateUrl: './weight-edit-sheet.html',
  styleUrl: './weight-edit-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeightEditSheet {
  readonly row = input.required<WeighLogRow | null>();
  /** The save or delete is running. */
  readonly busy = input(false, { transform: booleanAttribute });
  readonly errorMessage = input<string | null>(null);

  readonly saved = output<number>();
  readonly removed = output<void>();
  readonly closed = output<void>();

  private readonly t = injectTranslate();

  protected readonly isOpen = computed(() => this.row() !== null);
  /** `'I dag kl. 07:45'`. */
  protected readonly whenText = computed(() => {
    const row = this.row();
    return row ? this.t('weight.editSheet.when', { date: row.date, time: row.time }) : '';
  });
  /** `'i dag kl. 07:45'` · `'18. sep kl. 07:45'` – inside the delete question. */
  protected readonly confirmWhenText = computed(() => {
    const row = this.row();
    return row ? this.t('weight.editSheet.when', { date: row.dateInSentence, time: row.time }) : '';
  });

  // Falls back to the ruler's minimum only while closed, so the ruler never gets an invalid value.
  protected readonly draftKg = linkedSignal(() => this.row()?.kgValue ?? WEIGHT_MIN_KG);
  protected readonly draftText = computed(() => formatDecimal(this.draftKg()));
  protected readonly confirmingDelete = linkedSignal({
    source: this.row,
    computation: () => false,
  });

  protected setDraft(kg: number): void {
    this.draftKg.set(kg);
  }

  protected save(): void {
    this.saved.emit(this.draftKg());
  }

  protected askDelete(): void {
    this.confirmingDelete.set(true);
  }

  protected cancelDelete(): void {
    this.confirmingDelete.set(false);
  }

  protected confirmDelete(): void {
    this.removed.emit();
  }
}
