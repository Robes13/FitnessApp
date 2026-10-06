import { HttpStatusCode } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, finalize } from 'rxjs';
import { AUTH_ERROR_MESSAGE_KEY } from '../../../../core/constants/auth';
import { MAX_AGE, MIN_AGE } from '../../../../core/constants/nutrition';
import { ApiError } from '../../../../core/models/api-error';
import { GoalId } from '../../../../core/models/profile';
import { injectTranslate } from '../../../../core/services/language/translate';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator/nutrition-calculator';
import { toApiError } from '../../../../core/utils/api';
import { formatInteger } from '../../../../core/utils/date-format';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiOptionCard } from '../../../../shared/components/ui-option-card/ui-option-card';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { ProfileEditRowId, ProfileEditService } from '../../services/profile-edit';
import { clamp } from '../../../../core/utils/math';

const SAVE_FAILED_KEY = 'profile.edit.saveFailed';
const BIRTHDAY_INVALID_KEY = 'profile.edit.birthdayInvalid';
const NUMBER_RANGE_KEY = 'profile.edit.numberRange';
const EMAIL_SENT_KEY = 'profile.edit.emailSent';
/** `birthdayInvalid` interpolates the API's age range; the other keys ignore it. */
const AGE_RANGE = { min: MIN_AGE, max: MAX_AGE } as const;

/**
 * The "Rediger profil" sheet. One component covers all of the design's `editDefs` variants:
 *
 * - **options** – pick between cards; the choice is saved immediately and the sheet closes.
 * - **number** – −/+ around a number field, saved with "Gem".
 * - **date** – the birthday in a native date field, saved with "Gem".
 * - **text** – e-mail; a successful change says where the confirmation link went.
 *
 * Every save goes to the API (pessimistic): while it runs, "Gem" shows a spinner and the options
 * are disabled, so nothing is sent twice. On an error the sheet stays open with a message; on
 * success it closes. Closing without saving changes nothing; a running save can't be closed
 * away, so its result never lands on another row.
 *
 * A value that breaks the field's rule (outside the bounds, a birthday outside the age rule, an
 * e-mail without the right format) keeps "Gem" disabled, marks the field and says why. The three
 * field variants share one form control and one rule check (`fieldError`).
 *
 * The parent owns which row is open (`row`); `null` means closed.
 *
 * Goal weight follows the sign-up rules (see `ProfileEditService.goalWeightError`), and the
 * error is shown under the field. Picking a goal the stored goal weight doesn't fit switches
 * the sheet to the goal weight field (`pendingGoal`); the goal is only saved together with a
 * valid goal weight, so closing the sheet leaves the old goal untouched.
 */
@Component({
  selector: 'app-profile-edit-sheet',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    UiButton,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiOptionCard,
    UiSheet,
    UiTextInput,
  ],
  templateUrl: './profile-edit-sheet.html',
  styleUrl: './profile-edit-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileEditSheet {
  readonly row = input<ProfileEditRowId | null>(null);

  readonly closed = output<void>();

  private readonly editor = inject(ProfileEditService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly saving = signal(false);
  /** The new address after a successful e-mail change. Cleared when another row opens. */
  private readonly emailSentTo = linkedSignal<ProfileEditRowId | null, string | null>({
    source: this.row,
    computation: () => null,
  });
  protected readonly emailSentText = computed(() => {
    const email = this.emailSentTo();
    return email === null ? null : this.t(EMAIL_SENT_KEY, { email });
  });

  /** A goal waiting for a new goal weight. Reset whenever another row is opened. */
  private readonly pendingGoal = linkedSignal<ProfileEditRowId | null, GoalId | null>({
    source: this.row,
    computation: () => null,
  });

  protected readonly definition = computed(() => {
    const row = this.row();
    const pendingGoal = this.pendingGoal();
    if (pendingGoal !== null) {
      return this.editor.goalWeightDefinition(pendingGoal, true);
    }
    return row === null ? null : this.editor.definitionFor(row);
  });

  protected readonly isOpen = computed(() => this.definition() !== null);
  protected readonly title = computed(() => this.definition()?.title ?? '');

  /** The open field's value: a number, or text for the birthday and the e-mail. */
  protected readonly form = new FormGroup({
    value: new FormControl<number | string | null>(null),
  });
  private readonly control = this.form.controls.value;
  private readonly value = toSignal(this.control.valueChanges, { initialValue: null });
  /**
   * The failed save's error – a key, so it follows a language switch. It was about the value that
   * was sent, so it is cleared when another row opens and as soon as the value changes.
   */
  private readonly errorKey = linkedSignal({
    source: () => [this.row(), this.value()],
    computation: (): string | null => null,
  });
  /** The rule the open field's value breaks; an empty field is only "Gem" disabled. */
  private readonly fieldError = computed(() => {
    const definition = this.definition();
    const value = this.value();
    switch (definition?.kind) {
      case 'number': {
        if (typeof value !== 'number') {
          return null;
        }
        const { min, max, unit } = definition;
        const outOfRange = value < min || value > max;
        return (
          this.goalWeightErrorFor(value) ??
          (outOfRange
            ? this.t(NUMBER_RANGE_KEY, { min: formatInteger(min), max: formatInteger(max), unit })
            : null)
        );
      }
      case 'date':
        return typeof value === 'string' && value !== '' && !this.editor.isBirthdayValid(value)
          ? this.t(BIRTHDAY_INVALID_KEY, AGE_RANGE)
          : null;
      case 'text': {
        const email = typeof value === 'string' ? value.trim() : '';
        return email !== '' && !this.calculator.isValidEmail(email)
          ? this.t(AUTH_ERROR_MESSAGE_KEY.INVALID_EMAIL)
          : null;
      }
      default:
        return null;
    }
  });
  /** The broken rule, else the failed save's error. */
  protected readonly formError = computed(() => {
    const key = this.errorKey();
    return this.fieldError() ?? (key === null ? null : this.t(key, AGE_RANGE));
  });
  /** The field is marked for a broken rule or a value the API rejected – not a failed save. */
  protected readonly invalid = computed(
    () => this.fieldError() !== null || (this.errorKey() ?? SAVE_FAILED_KEY) !== SAVE_FAILED_KEY,
  );
  /** "Gem" is on once the field is filled in and breaks no rule. */
  protected readonly canSave = computed(() => {
    const value = this.value();
    return value !== null && String(value).trim() !== '' && this.fieldError() === null;
  });

  constructor() {
    // Every time the sheet opens on a new row, the field is filled with the current value.
    effect(() => {
      const definition = this.definition();
      if (definition !== null && definition.kind !== 'options') {
        this.control.setValue(definition.value);
      }
    });
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected pickOption(optionId: string): void {
    const row = this.row();
    if (row === null || this.saving()) {
      return;
    }
    this.submit(this.editor.applyOption(row, optionId), (result) => {
      if (result.kind === 'needs-goal-weight') {
        this.pendingGoal.set(result.goal);
        return;
      }
      this.closed.emit();
    });
  }

  /** −/+ moves one step at a time and clamps within the field's bounds (the design's `editMinus`). */
  protected stepNumber(direction: -1 | 1): void {
    const definition = this.definition();
    if (definition?.kind !== 'number') {
      return;
    }
    const current = typeof this.control.value === 'number' ? this.control.value : 0;
    const next = current + direction * definition.step;
    this.control.setValue(clamp(next, definition.min, definition.max));
  }

  /** Saves the open field; the profile keeps the old e-mail address until the link is tapped. */
  protected save(): void {
    const definition = this.definition();
    const row = this.row();
    const value = this.control.value;
    if (definition === null || row === null || !this.canSave() || this.saving()) {
      return;
    }
    const close = (): void => this.closed.emit();
    switch (definition.kind) {
      case 'number': {
        const pendingGoal = this.pendingGoal();
        this.submit(
          pendingGoal === null
            ? this.editor.applyNumber(row, Number(value))
            : this.editor.applyGoalWithGoalWeight(pendingGoal, Number(value)),
          close,
        );
        return;
      }
      case 'date':
        this.submit(this.editor.applyBirthday(String(value)), close);
        return;
      case 'text': {
        const email = String(value).trim();
        // The API sends no mail for the current address (it compares case-insensitively).
        if (email.toLowerCase() === definition.value.toLowerCase()) {
          close();
          return;
        }
        this.submit(this.editor.applyEmail(email), () => this.emailSentTo.set(email));
        return;
      }
      default:
        return;
    }
  }

  /** Runs a save; `done` gets its result. An error keeps the sheet open with a message. */
  private submit<T>(save: Observable<T>, done: (result: T) => void): void {
    const row = this.row();
    this.saving.set(true);
    this.errorKey.set(null);
    save
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: done,
        error: (error: unknown) => this.errorKey.set(errorKeyFor(row, toApiError(error))),
      });
  }

  /** `null` for every row but goal weight. Uses the pending goal while switching goal. */
  private goalWeightErrorFor(value: number): string | null {
    if (this.definition()?.id !== 'goalWeight') {
      return null;
    }
    return this.editor.goalWeightError(value, this.pendingGoal() ?? undefined);
  }
}

/** The birthday's 400 is the API's age rule; the e-mail's 409/400 are "taken"/"invalid". */
function errorKeyFor(row: ProfileEditRowId | null, error: ApiError): string {
  if (row === 'birthday' && error.status === HttpStatusCode.BadRequest) {
    return BIRTHDAY_INVALID_KEY;
  }
  if (
    row === 'email' &&
    (error.status === HttpStatusCode.Conflict || error.status === HttpStatusCode.BadRequest)
  ) {
    return error.messageKey;
  }
  return SAVE_FAILED_KEY;
}
