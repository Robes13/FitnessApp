import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { PASSWORD_MIN_LENGTH } from '../../../../../core/constants/nutrition';
import { UiFormError } from '../../../../../shared/components/ui-form-error/ui-form-error';
import { UiTextInput } from '../../../../../shared/components/ui-text-input/ui-text-input';
import { SignupStateService } from '../../../services/signup-state';

/** Designets `pwHint` – begge tekster er verbatim fra prototypen. */
const MISMATCH_HINT = 'Adgangskoderne er ikke ens.';
const MIN_LENGTH_HINT = 'Mindst 8 tegn.';

interface AccountForm {
  username: FormControl<string>;
  password: FormControl<string>;
  passwordRepeat: FormControl<string>;
}

/**
 * Trin 1 (`s1`): brugernavn og adgangskode to gange. Feltet for gentagelsen markeres, så
 * snart de to koder ikke er ens, og hint-linjen under felterne holder sin højde, så
 * layoutet ikke hopper.
 *
 * Trinnet har hverken inputs eller outputs: det skriver direkte i `SignupStateService`,
 * som også afgør, hvornår "Næste" er aktiv (`canContinue`).
 */
@Component({
  selector: 'app-account-step',
  imports: [ReactiveFormsModule, UiFormError, UiTextInput],
  templateUrl: './account-step.html',
  styleUrl: './account-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'account-step' },
})
export class AccountStep {
  private readonly state = inject(SignupStateService);

  protected readonly form = new FormGroup<AccountForm>({
    username: new FormControl(this.state.username(), { nonNullable: true }),
    password: new FormControl(this.state.password(), { nonNullable: true }),
    passwordRepeat: new FormControl(this.state.passwordRepeat(), { nonNullable: true }),
  });

  /** Designets `pwMismatch`: først når der er skrevet noget i gentagelsesfeltet. */
  protected readonly mismatch = computed(
    () =>
      this.state.passwordRepeat().length > 0 &&
      this.state.password() !== this.state.passwordRepeat(),
  );

  protected readonly hint = computed(() => {
    if (this.mismatch()) {
      return MISMATCH_HINT;
    }
    const password = this.state.password();
    return password.length > 0 && password.length < PASSWORD_MIN_LENGTH ? MIN_LENGTH_HINT : '';
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const { username, password, passwordRepeat } = this.form.getRawValue();
      this.state.username.set(username);
      this.state.password.set(password);
      this.state.passwordRepeat.set(passwordRepeat);
    });
  }
}
