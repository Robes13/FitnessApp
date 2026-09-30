import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, switchMap, timer } from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { PHOTO_SCREEN_THEME } from '../../../../core/constants/theme';
import { AUTH_ERROR_MESSAGE_KEY } from '../../../../core/constants/auth';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../../../core/constants/nutrition';
import { PasswordStrength } from '../../../../core/models/nutrition';
import { AuthApi } from '../../../../core/services/auth-api/auth-api';
import { isAuthToken, normalizeAuthToken } from '../../../../core/services/auth-api/auth-mapping';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator/nutrition-calculator';
import { SessionService } from '../../../../core/services/session/session';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { injectTranslate } from '../../../../core/services/language/translate';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import {
  FormErrorTone,
  UiFormError,
} from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiProgressBar } from '../../../../shared/components/ui-progress-bar/ui-progress-bar';
import { UiSpinner } from '../../../../shared/components/ui-spinner/ui-spinner';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { AUTH_ASSET } from '../../auth-assets';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';
import { holdDarkSystemBarsWhileOpen } from '../../photo-screen';

/** The design's `fp1 → fp2 → fp3 → fpDone`. */
export type ForgotPasswordStep = 'email' | 'code' | 'new-password' | 'done';

/** The wait on the confirmation step before the user is logged in (the design's `fpSave`). */
export const FORGOT_PASSWORD_DONE_DEFAULT_DELAY_MS = 1400;

/** Can be set to 0 in tests, so specs don't wait a second and a half. */
export const FORGOT_PASSWORD_DONE_DELAY_MS = new InjectionToken<number>(
  'FORGOT_PASSWORD_DONE_DELAY_MS',
  { providedIn: 'root', factory: () => FORGOT_PASSWORD_DONE_DEFAULT_DELAY_MS },
);

/** The design only shows the e-mail hint once more than three characters have been typed. */
const EMAIL_HINT_MIN_LENGTH = 3;
const MISMATCH_MESSAGE_KEY = 'auth.forgotPasswordPage.mismatch';
/** The flow's three input steps – shown as "Step n of 3". */
const STEP_TOTAL = 3;
const PERCENT_MAX = 100;

interface EmailForm {
  email: FormControl<string>;
}

interface CodeForm {
  code: FormControl<string>;
}

interface NewPasswordForm {
  password: FormControl<string>;
  repeat: FormControl<string>;
}

/** The text below the active field: either the design's hint (orange) or an error (red). */
interface StepMessage {
  readonly text: string;
  readonly tone: FormErrorTone;
}

const EMPTY_MESSAGE: StepMessage = { text: '', tone: 'accent' };

/**
 * The design's "Forgot password" (lines 113–182) as a single route component with four steps in
 * one signal: e-mail → code → new password → confirmation.
 *
 * The "code" is the 64-character token from the reset e-mail. The API has no endpoint to check
 * it on its own, so the code step only checks its format; `password/reset` validates it together
 * with the new password, and a used or expired token sends the user back to the code step.
 * The confirmation step waits `FORGOT_PASSWORD_DONE_DELAY_MS` and then logs in with the e-mail
 * from step 1 via `SessionService`; the wait is cleared by `takeUntilDestroyed` if the page is
 * left first. If that login fails, the step says the password is changed and links to login.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    AuthBackdrop,
    UiButton,
    UiFormError,
    UiIcon,
    UiIconButton,
    UiProgressBar,
    UiSpinner,
    UiTextInput,
  ],
  templateUrl: './forgot-password-page.html',
  styleUrl: './forgot-password-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'forgot-password-page', '[attr.data-theme]': 'photoTheme' },
})
export class ForgotPasswordPage {
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(SessionService);
  private readonly profile = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly doneDelayMs = inject(FORGOT_PASSWORD_DONE_DELAY_MS);
  private readonly t = injectTranslate();

  /** Dark in both themes – the photo behind is dark. */
  protected readonly photoTheme = PHOTO_SCREEN_THEME;
  protected readonly logoSrc = AUTH_ASSET.LOGO;
  protected readonly loginPath = APP_PATH.LOGIN;
  protected readonly passwordMaxLength = PASSWORD_MAX_LENGTH;
  protected readonly stepTotal = STEP_TOTAL;

  protected readonly step = signal<ForgotPasswordStep>('email');
  protected readonly loading = signal(false);
  protected readonly resent = signal(false);
  /** The normalized token from the code step, sent with the new password. */
  private readonly token = signal('');
  /** Translation key of the backend's error – translated in `message`, so it follows the language. */
  private readonly errorKey = signal<string | null>(null);

  protected readonly emailForm = new FormGroup<EmailForm>({
    email: new FormControl(this.session.email() ?? this.profile.profile().email, {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });
  protected readonly codeForm = new FormGroup<CodeForm>({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly passwordForm = new FormGroup<NewPasswordForm>({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
    }),
    repeat: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  private readonly emailValue = toSignal(this.emailForm.controls.email.valueChanges, {
    initialValue: this.emailForm.controls.email.value,
  });
  private readonly codeValue = toSignal(this.codeForm.controls.code.valueChanges, {
    initialValue: '',
  });
  private readonly passwordValue = toSignal(this.passwordForm.controls.password.valueChanges, {
    initialValue: '',
  });
  private readonly repeatValue = toSignal(this.passwordForm.controls.repeat.valueChanges, {
    initialValue: '',
  });

  /** Shown on step 2, so the user can see which address the code was sent to. */
  protected readonly email = computed(() => this.emailValue());

  protected readonly emailInvalid = computed(
    () => !this.calculator.isValidEmail(this.emailValue()),
  );
  protected readonly codeInvalid = computed(() => !isAuthToken(this.codeValue()));
  /** The design's `fpMismatch`: only once something has been typed in the repeat field. */
  protected readonly mismatch = computed(
    () => this.repeatValue().length > 0 && this.passwordValue() !== this.repeatValue(),
  );
  protected readonly saveDisabled = computed(
    () =>
      this.passwordValue().length < PASSWORD_MIN_LENGTH ||
      this.passwordValue() !== this.repeatValue(),
  );

  protected readonly strength: Signal<PasswordStrength> = computed(() =>
    this.calculator.passwordStrength(this.passwordValue()),
  );
  protected readonly strengthValue = computed(() => this.strength().percent / PERCENT_MAX);
  protected readonly strengthLabelClass = computed(
    () =>
      `forgot-password-page__strength-label forgot-password-page__strength-label--${this.strength().tone}`,
  );

  /** The password is changed, but the login with it failed – the confirmation offers login instead. */
  protected readonly loginFailed = computed(
    () => this.step() === 'done' && this.errorKey() !== null,
  );

  /** One place to decide what's shown below the field: an error beats the design's hint. */
  protected readonly message = computed<StepMessage>(() => {
    const errorKey = this.errorKey();
    if (errorKey !== null) {
      return { text: this.t(errorKey), tone: 'negative' };
    }
    switch (this.step()) {
      case 'email':
        return { text: this.emailHint(), tone: 'accent' };
      case 'code':
        return { text: this.codeHint(), tone: 'accent' };
      case 'new-password':
        return { text: this.passwordHint(), tone: 'accent' };
      default:
        return EMPTY_MESSAGE;
    }
  });

  private readonly emailHint = computed(() =>
    this.emailValue().length > EMAIL_HINT_MIN_LENGTH && this.emailInvalid()
      ? this.t(AUTH_ERROR_MESSAGE_KEY.INVALID_EMAIL)
      : '',
  );
  private readonly codeHint = computed(() =>
    this.codeValue().trim().length > 0 && this.codeInvalid()
      ? this.t(AUTH_ERROR_MESSAGE_KEY.INVALID_CODE)
      : '',
  );
  private readonly passwordHint = computed(() => {
    if (this.mismatch()) {
      return this.t(MISMATCH_MESSAGE_KEY);
    }
    const length = this.passwordValue().length;
    return length > 0 && length < PASSWORD_MIN_LENGTH
      ? this.t(AUTH_ERROR_MESSAGE_KEY.PASSWORD_TOO_SHORT)
      : '';
  });

  constructor() {
    holdDarkSystemBarsWhileOpen();
  }

  /** Step back; from the first step (and from the confirmation) back to login. */
  protected back(): void {
    this.errorKey.set(null);
    switch (this.step()) {
      case 'code':
        this.step.set('email');
        break;
      case 'new-password':
        this.step.set('code');
        break;
      default:
        void this.router.navigateByUrl(APP_PATH.LOGIN);
    }
  }

  protected sendCode(): void {
    this.run(this.authApi.forgotPassword({ email: this.emailValue().trim() }), () => {
      this.resent.set(false);
      this.step.set('code');
    });
  }

  protected resend(): void {
    this.run(this.authApi.forgotPassword({ email: this.emailValue().trim() }), () =>
      this.resent.set(true),
    );
  }

  /** Only the format is checked here – `password/reset` validates the token itself. */
  protected verifyCode(): void {
    if (this.codeInvalid()) {
      return;
    }
    this.token.set(normalizeAuthToken(this.codeValue()));
    this.errorKey.set(null);
    this.step.set('new-password');
  }

  protected savePassword(): void {
    const { password, repeat } = this.passwordForm.getRawValue();
    const request = { token: this.token(), newPassword: password, newPasswordConfirmation: repeat };
    this.run(this.authApi.resetPassword(request), () => {
      this.step.set('done');
      this.logInWithNewPassword(password);
    });
  }

  private run(request: Observable<void>, onSuccess: () => void): void {
    if (this.loading()) {
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading.set(false);
        onSuccess();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        const { messageKey } = toApiError(error);
        // A used or expired token can only be replaced on the code step.
        if (messageKey === AUTH_ERROR_MESSAGE_KEY.INVALID_CODE) {
          this.step.set('code');
        }
        this.errorKey.set(messageKey);
      },
    });
  }

  /**
   * The confirmation step: wait, log in with the e-mail from step 1 and the new password, and
   * proceed to Home. The token is used up by now, so a failed login can't go back to step 3 –
   * the confirmation says that the password *is* changed, shows the error and links to login.
   */
  private logInWithNewPassword(password: string): void {
    const email = this.emailValue().trim();
    timer(this.doneDelayMs)
      .pipe(
        switchMap(() => this.session.login(email, password)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(APP_PATH.HOME),
        error: (error: unknown) => this.errorKey.set(toApiError(error).messageKey),
      });
  }
}
