import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { AUTH_ASSET } from '../../auth-assets';
import { authErrorMessage } from '../../auth-error';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';

interface LoginForm {
  username: FormControl<string>;
  password: FormControl<string>;
}

/**
 * The design's login screen (lines 88–110): photo background, logo and wordmark at the top, the
 * heading "Spis klogt. / Træn stærkt." and the glass fields at the bottom.
 *
 * The login itself goes through `SessionService`, which talks to `AuthApi`. The button shows a
 * spinner while the call is in progress, and the backend's error text is shown in `app-ui-form-error`.
 */
@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, AuthBackdrop, UiButton, UiFormError, UiTextInput],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'login-page' },
})
export class LoginPage {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly logoSrc = AUTH_ASSET.LOGO;
  protected readonly signupPath = APP_PATH.SIGNUP;
  protected readonly forgotPasswordPath = APP_PATH.FORGOT_PASSWORD;

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup<LoginForm>({
    username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected submit(): void {
    if (this.loading()) {
      return;
    }
    const { username, password } = this.form.getRawValue();
    this.loading.set(true);
    this.errorMessage.set(null);
    this.session
      .login(username, password)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl(APP_PATH.HOME);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(authErrorMessage(error));
        },
      });
  }
}
