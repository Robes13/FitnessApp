import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { APP_PATH } from '../../../../core/constants/app-route';
import { PHOTO_SCREEN_THEME } from '../../../../core/constants/theme';
import { AuthApi } from '../../../../core/services/auth-api/auth-api';
import { SessionService } from '../../../../core/services/session/session';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';
import { AUTH_ASSET } from '../../auth-assets';
import { AuthBackdrop } from '../../components/auth-backdrop/auth-backdrop';
import { holdDarkSystemBarsWhileOpen } from '../../photo-screen';

interface ForgotPasswordForm {
  identifier: FormControl<string>;
}

/**
 * "Forgot password": the e-mail or username → `POST auth/password/forgot` → the neutral "if the
 * account exists" text with "Send again". The mail links to a page hosted by the API, where the
 * new password is chosen – the app never sees the token. The API answers 204 whether the account
 * exists or not, so the page can't (and doesn't) tell.
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
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** Dark in both themes – the photo behind is dark. */
  protected readonly photoTheme = PHOTO_SCREEN_THEME;
  protected readonly logoSrc = AUTH_ASSET.LOGO;
  protected readonly loginPath = APP_PATH.LOGIN;

  protected readonly form = new FormGroup<ForgotPasswordForm>({
    identifier: new FormControl(this.session.email() ?? '', { nonNullable: true }),
  });

  protected readonly loading = signal(false);
  /** The API has taken the request – the page shows the neutral text instead of the field. */
  protected readonly sent = signal(false);
  protected readonly resent = signal(false);
  /** Translation key of the error below the field – translated in the template. */
  protected readonly errorKey = signal<string | null>(null);

  protected readonly submitLabelKey = computed(() => {
    if (!this.sent()) {
      return 'auth.forgotPasswordPage.sendLink';
    }
    return this.resent() ? 'auth.forgotPasswordPage.resent' : 'auth.forgotPasswordPage.resend';
  });

  constructor() {
    holdDarkSystemBarsWhileOpen();
  }

  protected back(): void {
    void this.router.navigateByUrl(APP_PATH.LOGIN);
  }

  /** "Send link" and "Send again" – the same call; the API revokes the previous link. */
  protected send(): void {
    const emailOrUsername = this.form.controls.identifier.value.trim();
    if (this.loading() || emailOrUsername.length === 0) {
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    this.authApi
      .forgotPassword({ emailOrUsername })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.resent.set(this.sent());
          this.sent.set(true);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorKey.set(toApiError(error).messageKey);
        },
      });
  }
}
