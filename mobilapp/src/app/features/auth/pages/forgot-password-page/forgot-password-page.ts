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
import { Observable, switchMap, timer } from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { AUTH_ERROR_MESSAGE } from '../../../../core/constants/auth';
import { PASSWORD_MIN_LENGTH, RESET_CODE_LENGTH } from '../../../../core/constants/nutrition';
import { PasswordStrength } from '../../../../core/models/nutrition';
import { AuthApi } from '../../../../core/services/auth-api';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator';
import { SessionService } from '../../../../core/services/session';
import { UserProfileService } from '../../../../core/services/user-profile';
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
import { authErrorMessage } from '../../auth-error';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';

/** Designets `fp1 → fp2 → fp3 → fpDone`. */
export type ForgotPasswordStep = 'email' | 'code' | 'new-password' | 'done';

/** Ventetiden på kvitteringstrinnet, før brugeren logges ind (designets `fpSave`). */
export const FORGOT_PASSWORD_DONE_DEFAULT_DELAY_MS = 1400;

/** Kan sættes til 0 i tests, så specs ikke venter i halvandet sekund. */
export const FORGOT_PASSWORD_DONE_DELAY_MS = new InjectionToken<number>(
  'FORGOT_PASSWORD_DONE_DELAY_MS',
  { providedIn: 'root', factory: () => FORGOT_PASSWORD_DONE_DEFAULT_DELAY_MS },
);

/** Designet viser først e-mail-hintet, når der er skrevet mere end tre tegn. */
const EMAIL_HINT_MIN_LENGTH = 3;
const MISMATCH_MESSAGE = 'Adgangskoderne er ikke ens.';
const RESENT_MESSAGE = 'Sendt igen';
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

/** Teksten under det aktive felt: enten designets hint (orange) eller en fejl (rød). */
interface StepMessage {
  readonly text: string;
  readonly tone: FormErrorTone;
}

const EMPTY_MESSAGE: StepMessage = { text: '', tone: 'accent' };

/**
 * Designets "Glemt adgangskode" (linje 113–182) som ét route-komponent med fire trin i et
 * signal: e-mail → kode → ny adgangskode → kvittering.
 *
 * Hvert trin kalder mock-backenden (`AuthApi`) og viser en spinner i knappen imens.
 * Kvitteringstrinnet venter `FORGOT_PASSWORD_DONE_DELAY_MS` og logger derefter ind via
 * `SessionService`; ventetiden ryddes af `takeUntilDestroyed`, hvis siden forlades først.
 */
@Component({
  selector: 'app-forgot-password-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
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
  host: { class: 'forgot-password-page' },
})
export class ForgotPasswordPage {
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(SessionService);
  private readonly profile = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly doneDelayMs = inject(FORGOT_PASSWORD_DONE_DELAY_MS);

  protected readonly logoSrc = AUTH_ASSET.LOGO;
  protected readonly loginPath = APP_PATH.LOGIN;
  protected readonly codeLength = RESET_CODE_LENGTH;
  protected readonly resentMessage = RESENT_MESSAGE;

  protected readonly step = signal<ForgotPasswordStep>('email');
  protected readonly loading = signal(false);
  protected readonly resent = signal(false);
  private readonly errorMessage = signal<string | null>(null);

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

  /** Vises på trin 2, så brugeren kan se hvilken adresse koden er sendt til. */
  protected readonly email = computed(() => this.emailValue());

  protected readonly emailInvalid = computed(
    () => !this.calculator.isValidEmail(this.emailValue()),
  );
  protected readonly codeInvalid = computed(() => this.codeValue().length !== RESET_CODE_LENGTH);
  /** Designets `fpMismatch`: først når der er skrevet noget i gentag-feltet. */
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

  /** Ét sted at afgøre hvad der står under feltet: fejl slår designets hint. */
  protected readonly message = computed<StepMessage>(() => {
    const error = this.errorMessage();
    if (error !== null) {
      return { text: error, tone: 'negative' };
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
      ? AUTH_ERROR_MESSAGE.INVALID_EMAIL
      : '',
  );
  private readonly codeHint = computed(() => {
    const length = this.codeValue().length;
    return length > 0 && length < RESET_CODE_LENGTH ? AUTH_ERROR_MESSAGE.INVALID_CODE : '';
  });
  private readonly passwordHint = computed(() => {
    if (this.mismatch()) {
      return MISMATCH_MESSAGE;
    }
    const length = this.passwordValue().length;
    return length > 0 && length < PASSWORD_MIN_LENGTH ? AUTH_ERROR_MESSAGE.PASSWORD_TOO_SHORT : '';
  });

  constructor() {
    // Designets `setFpCode`: kun cifre, højst fire. Sættet udsender igen, så signalet følger med.
    this.codeForm.controls.code.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const digits = value.replace(NON_DIGIT_PATTERN, '').slice(0, RESET_CODE_LENGTH);
        if (digits !== value) {
          this.codeForm.controls.code.setValue(digits);
        }
      });
  }

  /** Trin tilbage; fra første trin (og fra kvitteringen) tilbage til login. */
  protected back(): void {
    this.errorMessage.set(null);
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
    this.errorMessage.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.loading.set(false);
        onSuccess();
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorMessage.set(authErrorMessage(error));
      },
    });
  }

  /**
   * Kvitteringstrinnet: vent, log ind med profilens gemte brugernavn og den nye kode, og videre
   * til Hjem. Fejler loginet, ryger brugeren tilbage til trin 3 med fejlteksten.
   *
   * Det er det rå brugernavn – ikke `displayName()`, hvis demo-navn ellers ville blive gemt som
   * brugerens rigtige brugernavn af `SessionService.login()`. Er profilen tom, er der intet at
   * logge ind med (`AuthApi.login('')` fejler med `MISSING_CREDENTIALS`), så brugeren sendes til
   * login og skriver det selv.
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
          this.errorMessage.set(authErrorMessage(error));
        },
      });
  }
}
