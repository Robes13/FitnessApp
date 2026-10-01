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
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, finalize, map } from 'rxjs';
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
import {
  DateEditDefinition,
  NumberEditDefinition,
  OptionsEditDefinition,
  ProfileEditRowId,
  ProfileEditService,
  TextEditDefinition,
} from '../../services/profile-edit';
import { clamp } from '../../../../core/utils/math';

interface NumberForm {
  value: FormControl<number | null>;
}

interface TextForm {
  value: FormControl<string>;
}

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
 * e-mail without the right format) keeps "Gem" disabled, marks the field and says why.
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
  protected readonly hint = computed(() => this.definition()?.hint ?? '');
  protected readonly optionsDefinition = computed<OptionsEditDefinition | null>(() => {
    const definition = this.definition();
    return definition?.kind === 'options' ? definition : null;
  });
  protected readonly numberDefinition = computed<NumberEditDefinition | null>(() => {
    const definition = this.definition();
    return definition?.kind === 'number' ? definition : null;
  });
  protected readonly textDefinition = computed<TextEditDefinition | null>(() => {
    const definition = this.definition();
    return definition?.kind === 'text' ? definition : null;
  });
  protected readonly dateDefinition = computed<DateEditDefinition | null>(() => {
    const definition = this.definition();
    return definition?.kind === 'date' ? definition : null;
  });

  protected readonly numberForm = new FormGroup<NumberForm>({
    value: new FormControl<number | null>(null),
  });
  protected readonly textForm = new FormGroup<TextForm>({
    value: new FormControl('', { nonNullable: true }),
  });
  protected readonly dateForm = new FormGroup<TextForm>({
    value: new FormControl('', { nonNullable: true }),
  });
  private readonly numberValue = toSignal(this.numberForm.controls.value.valueChanges, {
    initialValue: null,
  });
  private readonly textValue = toSignal(this.textForm.controls.value.valueChanges, {
    initialValue: '',
  });
  private readonly dateValue = toSignal(this.dateForm.controls.value.valueChanges, {
    initialValue: '',
  });
  /**
   * The failed save's error – a key, so it follows a language switch. It was about the value that
   * was sent, so it is cleared when another row opens and as soon as the value changes.
   */
  private readonly errorKey = linkedSignal({
    source: () => [this.row(), this.numberValue(), this.textValue(), this.dateValue()],
    computation: (): string | null => null,
  });
  /** The rule the open field's value breaks; an empty field is only "Gem" disabled. */
  private readonly fieldError = computed(() => {
    const number = this.numberDefinition();
    const value = this.numberValue();
    if (number !== null && value !== null) {
      const { min, max, unit } = number;
      const outOfRange = value < min || value > max;
      return (
        this.goalWeightErrorFor(value) ??
        (outOfRange
          ? this.t(NUMBER_RANGE_KEY, { min: formatInteger(min), max: formatInteger(max), unit })
          : null)
      );
    }
    const date = this.dateValue();
    if (this.dateDefinition() !== null && date !== '' && !this.editor.isBirthdayValid(date)) {
      return this.t(BIRTHDAY_INVALID_KEY, AGE_RANGE);
    }
    const email = this.textValue().trim();
    if (this.textDefinition() !== null && email !== '' && !this.calculator.isValidEmail(email)) {
      return this.t(AUTH_ERROR_MESSAGE_KEY.INVALID_EMAIL);
    }
    return null;
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

  private readonly numberStatus = toSignal(
    this.numberForm.statusChanges.pipe(map(() => this.numberForm.valid)),
    { initialValue: false },
  );
  private readonly textStatus = toSignal(
    this.textForm.statusChanges.pipe(map(() => this.textForm.valid)),
    { initialValue: false },
  );
  private readonly dateStatus = toSignal(
    this.dateForm.statusChanges.pipe(map(() => this.dateForm.valid)),
    { initialValue: false },
  );

  protected readonly canSaveNumber = this.numberStatus;
  protected readonly canSaveText = this.textStatus;
  protected readonly canSaveDate = this.dateStatus;

  constructor() {
    // Every time the sheet opens on a new row, the right field is filled with the current value.
    effect(() => {
      const definition = this.definition();
      if (definition === null) {
        return;
      }
      switch (definition.kind) {
        case 'number':
          this.numberForm.controls.value.setValidators([
            Validators.required,
            Validators.min(definition.min),
            Validators.max(definition.max),
            (control) => this.validGoalWeight(control),
          ]);
          this.numberForm.controls.value.setValue(definition.value);
          this.numberForm.controls.value.updateValueAndValidity();
          return;
        case 'text':
          this.textForm.controls.value.setValidators([
            Validators.required,
            (control) => this.validEmail(control),
          ]);
          this.textForm.controls.value.setValue(definition.value);
          this.textForm.controls.value.updateValueAndValidity();
          return;
        case 'date':
          this.dateForm.controls.value.setValidators([
            Validators.required,
            (control) =>
              this.editor.isBirthdayValid(String(control.value)) ? null : { birthday: true },
          ]);
          this.dateForm.controls.value.setValue(definition.value);
          this.dateForm.controls.value.updateValueAndValidity();
          return;
        default:
          return;
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
    const definition = this.numberDefinition();
    if (definition === null) {
      return;
    }
    const current = this.numberForm.controls.value.value ?? 0;
    const next = current + direction * definition.step;
    this.numberForm.controls.value.setValue(clamp(next, definition.min, definition.max));
  }

  protected saveNumber(): void {
    const row = this.row();
    const value = this.numberForm.controls.value.value;
    if (row === null || value === null || !this.numberForm.valid || this.saving()) {
      return;
    }
    const pendingGoal = this.pendingGoal();
    this.submit(
      pendingGoal === null
        ? this.editor.applyNumber(row, value)
        : this.editor.applyGoalWithGoalWeight(pendingGoal, value),
      () => this.closed.emit(),
    );
  }

  protected saveDate(): void {
    if (!this.dateForm.valid || this.saving()) {
      return;
    }
    this.submit(this.editor.applyBirthday(this.dateForm.controls.value.value), () =>
      this.closed.emit(),
    );
  }

  /** The profile keeps the old address until the link is tapped – the sheet says so. */
  protected saveText(): void {
    if (!this.textForm.valid || this.saving()) {
      return;
    }
    const email = this.textForm.controls.value.value.trim();
    // The API sends no mail for the current address (it compares case-insensitively).
    if (email.toLowerCase() === this.textDefinition()?.value.toLowerCase()) {
      this.closed.emit();
      return;
    }
    this.submit(this.editor.applyEmail(email), () => this.emailSentTo.set(email));
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

  private validGoalWeight(control: AbstractControl): ValidationErrors | null {
    const value = control.value as number | null;
    return value !== null && this.goalWeightErrorFor(value) !== null ? { goalWeight: true } : null;
  }

  /** `null` for every row but goal weight. Uses the pending goal while switching goal. */
  private goalWeightErrorFor(value: number): string | null {
    if (this.definition()?.id !== 'goalWeight') {
      return null;
    }
    return this.editor.goalWeightError(value, this.pendingGoal() ?? undefined);
  }

  private validEmail(control: AbstractControl): ValidationErrors | null {
    return this.calculator.isValidEmail(String(control.value ?? '')) ? null : { email: true };
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
