import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { isAuthToken } from '../../../../core/services/auth-api/auth-mapping';
import { injectTranslate } from '../../../../core/services/language/translate';
import { SessionService } from '../../../../core/services/session/session';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';

interface VerifyEmailForm {
  token: FormControl<string>;
}

/** Shown in place of the address if the session doesn't know it. */
const EMAIL_FALLBACK_KEY = 'home.verifyEmail.emailFallback';
/** One extra rotation per check, matching the design's `refreshRot`. */
const ROTATION_PER_CHECK_DEG = 360;

/**
 * "Tjek din mail" – the sheet that locks Home while the session is `pending-verification`. It
 * cannot be dismissed (`hideClose`): neither the scrim, Escape, nor a close button dismiss it.
 *
 * The user pastes the code from the e-mail and confirms, requests a new code, or presses
 * "Tjek igen" (which tries to log in, since the API has no status endpoint). The API can't
 * change the e-mail of an unverified account, so instead of the design's "Ændre mail" the user
 * can go back to login. All actions go through `SessionService`.
 */
@Component({
  selector: 'app-verify-email-sheet',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    UiButton,
    UiFormError,
    UiIcon,
    UiSheet,
    UiTextInput,
  ],
  templateUrl: './verify-email-sheet.html',
  styleUrl: './verify-email-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailSheet {
  readonly open = input.required<boolean>();

  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly form = new FormGroup<VerifyEmailForm>({
    token: new FormControl('', { nonNullable: true }),
  });

  private readonly tokenValue = toSignal(this.form.controls.token.valueChanges, {
    initialValue: '',
  });

  protected readonly confirming = signal(false);
  protected readonly resending = signal(false);
  protected readonly resent = signal(false);
  protected readonly checking = signal(false);
  protected readonly leaving = signal(false);
  protected readonly failedChecks = signal(0);
  protected readonly rotationDeg = signal(0);
  /** The error's translation key, so a shown error follows a language switch. */
  private readonly errorKey = signal<string | null>(null);
  protected readonly errorMessage = computed(() => {
    const key = this.errorKey();
    return key === null ? null : this.t(key);
  });

  protected readonly emailLabel = computed(
    () => this.session.email() ?? this.t(EMAIL_FALLBACK_KEY),
  );
  protected readonly tokenValid = computed(() => isAuthToken(this.tokenValue()));
  /** Flagged once something is pasted that can't be a code. */
  protected readonly tokenInvalid = computed(
    () => this.tokenValue().trim().length > 0 && !this.tokenValid(),
  );
  protected readonly resendLabel = computed(() =>
    this.t(this.resent() ? 'home.verifyEmail.resendSent' : 'home.verifyEmail.resend'),
  );
  protected readonly resendHint = computed(() =>
    this.t(this.resent() ? 'home.verifyEmail.resendHintSent' : 'home.verifyEmail.resendHint'),
  );
  protected readonly checkLabel = computed(() => {
    if (this.checking()) {
      return this.t('home.verifyEmail.checking');
    }
    return this.t(
      this.failedChecks() > 0 ? 'home.verifyEmail.notVerified' : 'home.verifyEmail.checkAgain',
    );
  });
  protected readonly rotation = computed(() => `${this.rotationDeg()}deg`);

  /** Verifies the code; the session then logs in, and Home unlocks. */
  protected confirm(): void {
    if (!this.tokenValid() || this.confirming()) {
      return;
    }
    this.run(this.session.verifyEmail(this.tokenValue()), this.confirming, () => undefined);
  }

  protected resend(): void {
    this.run(this.session.resendVerification(), this.resending, () => this.resent.set(true));
  }

  protected check(): void {
    if (this.checking()) {
      return;
    }
    this.rotationDeg.update((degrees) => degrees + ROTATION_PER_CHECK_DEG);
    this.run(this.session.checkVerification(), this.checking, (verified) => {
      if (!verified) {
        this.failedChecks.update((count) => count + 1);
      }
    });
  }

  /** Ends the pending session – e.g. to sign up again with a corrected e-mail. */
  protected backToLogin(): void {
    this.run(this.session.logout(), this.leaving, () => {
      void this.router.navigateByUrl(APP_PATH.LOGIN);
    });
  }

  private run<T>(
    request: Observable<T>,
    busy: WritableSignal<boolean>,
    onSuccess: (value: T) => void,
  ): void {
    this.errorKey.set(null);
    busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (value) => {
        busy.set(false);
        onSuccess(value);
      },
      error: (error: unknown) => {
        busy.set(false);
        this.errorKey.set(toApiError(error).messageKey);
      },
    });
  }
}
