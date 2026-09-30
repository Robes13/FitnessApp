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
import { PASSWORD_MIN_LENGTH, RESET_CODE_LENGTH } from '../../../../core/constants/nutrition';
import { PasswordStrength } from '../../../../core/models/nutrition';
import { AuthApi } from '../../../../core/services/auth-api/auth-api';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator/nutrition-calculator';
import { SessionService } from '../../../../core/services/session/session';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { injectTranslate } from '../../../../core/services/language/translate';
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
import { authErrorKey } from '../../auth-error';
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
const NON_DIGIT_PATTERN = /\D/g;

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
 * Each step calls the backend through `AuthApi` and shows a spinner in the button meanwhile.
 * The confirmation step waits `FORGOT_PASSWORD_DONE_DELAY_MS` and then logs in via
 * `SessionService`; the wait is cleared by `takeUntilDestroyed` if the page is left first.
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
  protected readonly codeLength = RESET_CODE_LENGTH;
  protected readonly stepTotal = STEP_TOTAL;

  protected readonly step = signal<ForgotPasswordStep>('email');
  protected readonly loading = signal(false);
  protected readonly resent = signal(false);
  /** Translation key of the backend's error – translated in `message`, so it follows the language. */
  private readonly errorKey = signal<string | null>(null);

  protected readonly emailForm = new FormGroup<EmailForm>({
    email: new FormControl(this.profile.profile().email, {
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
  protected readonly codeInvalid = computed(() => this.codeValue().length !== RESET_CODE_LENGTH);
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
  private readonly codeHint = computed(() => {
    const length = this.codeValue().length;
    return length > 0 && length < RESET_CODE_LENGTH
      ? this.t(AUTH_ERROR_MESSAGE_KEY.INVALID_CODE)
      : '';
  });
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

    // The design's `setFpCode`: digits only, at most four. The set re-emits so the signal keeps up.
    this.codeForm.controls.code.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const digits = value.replace(NON_DIGIT_PATTERN, '').slice(0, RESET_CODE_LENGTH);
        if (digits !== value) {
          this.codeForm.controls.code.setValue(digits);
        }
      });
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
    this.run(this.authApi.requestPasswordReset(this.emailValue()), () => {
      this.resent.set(false);
      this.step.set('code');
    });
  }

  protected resend(): void {
    this.run(this.authApi.requestPasswordReset(this.emailValue()), () => this.resent.set(true));
  }

  protected verifyCode(): void {
    this.run(this.authApi.verifyResetCode(this.codeValue()), () => this.step.set('new-password'));
  }

  protected savePassword(): void {
    const password = this.passwordForm.getRawValue().password;
    this.run(this.authApi.resetPassword(password), () => {
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
        this.errorKey.set(authErrorKey(error));
      },
    });
  }

  /**
   * The confirmation step: wait, log in with the profile's saved username and the new password, and
   * proceed to Home. If the login fails, the user is sent back to step 3 with the error text.
   *
   * If the profile is empty, there's nothing to log in with, so the user is sent to login and
   * types the username themselves.
   */
  private logInWithNewPassword(password: string): void {
    const username = this.profile.profile().username.trim();
    if (username === '') {
      timer(this.doneDelayMs)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => void this.router.navigateByUrl(APP_PATH.LOGIN));
      return;
    }
    timer(this.doneDelayMs)
      .pipe(
        switchMap(() => this.session.login(username, password)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => void this.router.navigateByUrl(APP_PATH.HOME),
        error: (error: unknown) => {
          this.step.set('new-password');
          this.errorKey.set(authErrorKey(error));
        },
      });
  }
}
