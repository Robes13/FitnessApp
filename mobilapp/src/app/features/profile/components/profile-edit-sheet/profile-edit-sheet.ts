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
import { map } from 'rxjs';
import { PASSWORD_MIN_LENGTH } from '../../../../core/constants/nutrition';
import { ApiError } from '../../../../core/models/api-error';
import { GoalId } from '../../../../core/models/profile';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiOptionCard } from '../../../../shared/components/ui-option-card/ui-option-card';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import {
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

interface PasswordForm {
  password: FormControl<string>;
  repeat: FormControl<string>;
}

/** Shown if the backend responds with something unexpected. */
const GENERIC_ERROR = 'Adgangskoden kunne ikke gemmes. Prøv igen.';

/**
 * The "Rediger profil" sheet. One component covers all of the design's `editDefs` variants:
 *
 * - **options** – pick between cards; the choice is saved immediately and the sheet closes.
 * - **number** – −/+ around a number field, saved with "Gem".
 * - **text** – e-mail.
 * - **password** – two fields that must match and be at least 8 characters. The password
 *   isn't part of the profile, so it's sent to the backend; the button shows a spinner meanwhile.
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
  protected readonly isPassword = computed(() => this.definition()?.kind === 'password');
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

  protected readonly numberForm = new FormGroup<NumberForm>({
    value: new FormControl<number | null>(null),
  });
  protected readonly textForm = new FormGroup<TextForm>({
    value: new FormControl('', { nonNullable: true }),
  });
  protected readonly passwordForm = new FormGroup<PasswordForm>(
    {
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      }),
      repeat: new FormControl('', { nonNullable: true }),
    },
    { validators: passwordsMatch },
  );

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly numberValue = toSignal(this.numberForm.controls.value.valueChanges, {
    initialValue: null,
  });
  /** The goal weight rule that the current value breaks, shown under the field. */
  protected readonly numberError = computed(() => {
    const value = this.numberValue();
    return value === null ? null : this.goalWeightErrorFor(value);
  });

  private readonly numberStatus = toSignal(
    this.numberForm.statusChanges.pipe(map(() => this.numberForm.valid)),
    { initialValue: false },
  );
  private readonly textStatus = toSignal(
    this.textForm.statusChanges.pipe(map(() => this.textForm.valid)),
    { initialValue: false },
  );
  private readonly passwordStatus = toSignal(
    this.passwordForm.statusChanges.pipe(map(() => this.passwordForm.valid)),
    { initialValue: false },
  );

  protected readonly canSaveNumber = computed(() => this.numberStatus() && !this.saving());
  protected readonly canSaveText = computed(() => this.textStatus() && !this.saving());
  protected readonly canSavePassword = computed(() => this.passwordStatus() && !this.saving());

  constructor() {
    // Every time the sheet opens on a new row, the right field is filled with the current value.
    effect(() => {
      const definition = this.definition();
      this.saving.set(false);
      this.errorMessage.set(null);
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
        case 'password':
          this.passwordForm.reset({ password: '', repeat: '' });
          this.passwordForm.updateValueAndValidity();
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
    if (row === null) {
      return;
    }
    const result = this.editor.applyOption(row, optionId);
    if (result.kind === 'needs-goal-weight') {
      this.pendingGoal.set(result.goal);
      return;
    }
    this.closed.emit();
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
    if (row === null || value === null || !this.numberForm.valid) {
      return;
    }
    const pendingGoal = this.pendingGoal();
    const saved =
      pendingGoal === null
        ? this.editor.applyNumber(row, value)
        : this.editor.applyGoalWithGoalWeight(pendingGoal, value);
    if (saved) {
      this.closed.emit();
    }
  }

  protected saveText(): void {
    if (!this.textForm.valid) {
      return;
    }
    this.editor.applyEmail(this.textForm.controls.value.value);
    this.closed.emit();
  }

  protected savePassword(): void {
    if (!this.passwordForm.valid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.editor
      .changePassword(this.passwordForm.controls.password.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closed.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(toErrorMessage(error));
        },
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

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value as string | undefined;
  const repeat = group.get('repeat')?.value as string | undefined;
  return password === repeat ? null : { mismatch: true };
}

function toErrorMessage(error: unknown): string {
  const message = (error as Partial<ApiError> | null)?.message;
  return typeof message === 'string' && message !== '' ? message : GENERIC_ERROR;
}
