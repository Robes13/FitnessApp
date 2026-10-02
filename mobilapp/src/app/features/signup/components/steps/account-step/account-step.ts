import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { USERNAME_MAX_LENGTH, USERNAME_PATTERN } from '../../../../../core/constants/auth';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../../../core/constants/nutrition';
import { KeyboardService } from '../../../../../core/services/keyboard/keyboard';
import { injectTranslate } from '../../../../../core/services/language/translate';
import { UiFormError } from '../../../../../shared/components/ui-form-error/ui-form-error';
import { UiTextInput } from '../../../../../shared/components/ui-text-input/ui-text-input';
import { SignupStateService } from '../../../services/signup-state';

/** Design's `pwHint` – both texts are verbatim from the prototype. */
const MISMATCH_HINT_KEY = 'signup.accountStep.mismatchHint';
const MIN_LENGTH_HINT_KEY = 'signup.accountStep.minLengthHint';
/** Not in the design: the API's username rule (3–50 of a–z, A–Z, 0–9, `-` and `_`). */
const USERNAME_RULE_HINT_KEY = 'signup.accountStep.usernameRule';

interface AccountForm {
  username: FormControl<string>;
  password: FormControl<string>;
  passwordRepeat: FormControl<string>;
}

/**
 * Step 1 (`s1`): username and password, entered twice. The repeat field is flagged as
 * soon as the two passwords don't match, and the hint line under the fields keeps its
 * height so the layout doesn't jump. The fields stop at the API's maximum lengths.
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
  private readonly document = inject(DOCUMENT);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly keyboardOpen = inject(KeyboardService).isOpen;
  private readonly hintLine = viewChild.required<UiFormError, ElementRef<HTMLElement>>(
    UiFormError,
    { read: ElementRef },
  );

  protected readonly usernameMaxLength = USERNAME_MAX_LENGTH;
  protected readonly passwordMaxLength = PASSWORD_MAX_LENGTH;

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
    const username = this.state.username();
    if (username.length > 0 && !USERNAME_PATTERN.test(username)) {
      return this.t(USERNAME_RULE_HINT_KEY);
    }
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

    // Above the on-screen keyboard the step shows little more than the fields, and the hint –
    // why "Next" is disabled – would sit just out of view (only the focused field is revealed).
    afterRenderEffect(() => {
      if (this.keyboardOpen() && this.hint() !== '') {
        this.revealHint();
      }
    });
  }

  /** The hint into view, then the field being typed in again, so it wins if both don't fit. */
  private revealHint(): void {
    this.hintLine().nativeElement.scrollIntoView({ block: 'nearest' });
    const focused = this.document.activeElement;
    if (focused instanceof HTMLElement && this.host.nativeElement.contains(focused)) {
      focused.scrollIntoView({ block: 'nearest' });
    }
  }
}
