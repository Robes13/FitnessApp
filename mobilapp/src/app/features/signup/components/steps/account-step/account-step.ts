import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { PASSWORD_MIN_LENGTH } from '../../../../../core/constants/nutrition';
import { injectTranslate } from '../../../../../core/services/language/translate';
import { UiFormError } from '../../../../../shared/components/ui-form-error/ui-form-error';
import { UiTextInput } from '../../../../../shared/components/ui-text-input/ui-text-input';
import { SignupStateService } from '../../../services/signup-state';

/** Design's `pwHint` – both texts are verbatim from the prototype. */
const MISMATCH_HINT_KEY = 'signup.accountStep.mismatchHint';
const MIN_LENGTH_HINT_KEY = 'signup.accountStep.minLengthHint';

interface AccountForm {
  username: FormControl<string>;
  password: FormControl<string>;
  passwordRepeat: FormControl<string>;
}

/**
 * Step 1 (`s1`): username and password, entered twice. The repeat field is flagged as
 * soon as the two passwords don't match, and the hint line under the fields keeps its
 * height so the layout doesn't jump.
 *
 * The step has neither inputs nor outputs: it writes directly to `SignupStateService`,
 * which also decides when "Next" is active (`canContinue`).
 */
@Component({
  selector: 'app-account-step',
  imports: [ReactiveFormsModule, TranslatePipe, UiFormError, UiTextInput],
  templateUrl: './account-step.html',
  styleUrl: './account-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'account-step' },
})
export class AccountStep {
  private readonly state = inject(SignupStateService);
  private readonly t = injectTranslate();

  protected readonly form = new FormGroup<AccountForm>({
    username: new FormControl(this.state.username(), { nonNullable: true }),
    password: new FormControl(this.state.password(), { nonNullable: true }),
    passwordRepeat: new FormControl(this.state.passwordRepeat(), { nonNullable: true }),
  });

  /** Design's `pwMismatch`: only once something has been typed in the repeat field. */
  protected readonly mismatch = computed(
    () =>
      this.state.passwordRepeat().length > 0 &&
      this.state.password() !== this.state.passwordRepeat(),
  );

  protected readonly hint = computed(() => {
    if (this.mismatch()) {
      return this.t(MISMATCH_HINT_KEY);
    }
    const password = this.state.password();
    return password.length > 0 && password.length < PASSWORD_MIN_LENGTH
      ? this.t(MIN_LENGTH_HINT_KEY)
      : '';
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
