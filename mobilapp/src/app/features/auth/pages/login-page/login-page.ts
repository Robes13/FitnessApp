import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_PATH } from '../../../../core/constants/app-route';
import { PHOTO_SCREEN_THEME } from '../../../../core/constants/theme';
import { SessionService } from '../../../../core/services/session/session';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { AUTH_ASSET } from '../../auth-assets';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';
import { holdDarkSystemBarsWhileOpen } from '../../photo-screen';

interface LoginForm {
  identifier: FormControl<string>;
  password: FormControl<string>;
}

/**
 * The design's login screen (lines 88–110): photo background, logo and wordmark at the top, the
 * heading "Spis klogt. / Træn stærkt." and the glass fields at the bottom.
 *
 * One field takes the e-mail or the username (the API tells them apart by the `@`). The login
 * itself goes through `SessionService`; the button shows a spinner while the call is in progress,
 * and the error is shown in `app-ui-form-error`. An unverified e-mail is no error: the session
 * becomes `pending-verification`, and Home shows the verification sheet. The field is filled in
 * with the e-mail the session remembers after a log out or an app restart.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    AuthBackdrop,
    UiButton,
    UiFormError,
    UiTextInput,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'login-page', '[attr.data-theme]': 'photoTheme' },
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Dark in both themes – the photo behind is dark. */
  protected readonly photoTheme = PHOTO_SCREEN_THEME;
  protected readonly logoSrc = AUTH_ASSET.LOGO;
  protected readonly signupPath = APP_PATH.SIGNUP;
  protected readonly forgotPasswordPath = APP_PATH.FORGOT_PASSWORD;

  protected readonly loading = signal(false);
  /** Translation key of the error shown below the fields – translated in the template. */
  protected readonly errorKey = signal<string | null>(null);

  protected readonly form = new FormGroup<LoginForm>({
    identifier: new FormControl(this.session.email() ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    holdDarkSystemBarsWhileOpen();
  }

  protected submit(): void {
    // Both fields are required – an empty one would only get the API's generic 400 back.
    if (this.loading() || this.form.invalid) {
      return;
    }
    const { identifier, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorKey.set(null);
    this.session
      .login(identifier, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl(APP_PATH.HOME);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorKey.set(toApiError(error).messageKey);
        },
      });
  }
}
