import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import {
  EMPTY,
  Observable,
  catchError,
  exhaustMap,
  filter,
  fromEvent,
  merge,
  of,
  Subscription,
  switchMap,
  tap,
  timer,
} from 'rxjs';
import { APP_PATH } from '../../../../core/constants/app-route';
import { VERIFICATION_POLL_MS } from '../../../../core/constants/auth';
import { injectTranslate } from '../../../../core/services/language/translate';
import { SessionService } from '../../../../core/services/session/session';
import { toApiError } from '../../../../core/utils/api';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';

/** Shown in place of the address if the session doesn't know it (a login with a username). */
const EMAIL_FALLBACK_KEY = 'home.verifyEmail.emailFallback';

/**
 * "Tjek din mail" – the sheet that locks Home while the session is `pending-verification`. It
 * cannot be dismissed (`hideClose`): neither the scrim, Escape, nor a close button dismiss it.
 *
 * The mail has a link to a page on the API that verifies the e-mail. While the sheet is open it
 * checks every `VERIFICATION_POLL_MS` and whenever the app becomes visible again (the user comes
 * back from the mail app) with `SessionService.checkVerification()` – a login with the password in
 * memory. Once that works the session is `authenticated`, and Home's `[open]` closes the sheet.
 * The user can also have a new link sent, or go back to login.
 */
@Component({
  selector: 'app-verify-email-sheet',
  imports: [TranslatePipe, UiButton, UiFormError, UiIcon, UiSheet],
  templateUrl: './verify-email-sheet.html',
  styleUrl: './verify-email-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailSheet {
  readonly open = input.required<boolean>();

  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly resending = signal(false);
  protected readonly resent = signal(false);
  protected readonly leaving = signal(false);
  /** The error's translation key, so a shown error follows a language switch. */
  private readonly errorKey = signal<string | null>(null);
  /** The last check's error – kept apart, so the next check that works clears only this one. */
  private readonly checkErrorKey = signal<string | null>(null);
  protected readonly errorMessage = computed(() => {
    const key = this.errorKey() ?? this.checkErrorKey();
    return key === null ? null : this.t(key);
  });

  protected readonly emailLabel = computed(
    () => this.session.email() ?? this.t(EMAIL_FALLBACK_KEY),
  );
  protected readonly resendHint = computed(() =>
    this.t(this.resent() ? 'home.verifyEmail.resendHintSent' : 'home.verifyEmail.resendHint'),
  );

  private readonly polling: Subscription;

  constructor() {
    // A failed check (e.g. no network) is shown until a check works, and the polling goes on;
    // `exhaustMap` skips a tick while a check is still running.
    this.polling = toObservable(this.open)
      .pipe(
        switchMap((open) =>
          open
            ? merge(
                timer(VERIFICATION_POLL_MS, VERIFICATION_POLL_MS),
                fromEvent(this.document, 'visibilitychange').pipe(
                  filter(() => this.document.visibilityState === 'visible'),
                ),
              )
            : EMPTY,
        ),
        exhaustMap(() =>
          this.session.checkVerification().pipe(
            tap(() => this.checkErrorKey.set(null)),
            catchError((error: unknown) => {
              this.checkErrorKey.set(toApiError(error).messageKey);
              return of(false);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** A new link – the API invalidates the earlier ones. */
  protected resend(): void {
    this.run(this.session.resendVerification(), this.resending, () => this.resent.set(true));
  }

  /** Ends the pending session – e.g. to sign up again with a corrected e-mail. */
  protected backToLogin(): void {
    // First cancel a check in flight: its answer could revive the session just ended.
    this.polling.unsubscribe();
    this.run(this.session.logout(), this.leaving, () => {
      void this.router.navigateByUrl(APP_PATH.LOGIN);
    });
  }

  private run(
    request: Observable<void>,
    busy: WritableSignal<boolean>,
    onSuccess: () => void,
  ): void {
    this.errorKey.set(null);
    busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        busy.set(false);
        onSuccess();
      },
      error: (error: unknown) => {
        busy.set(false);
        this.errorKey.set(toApiError(error).messageKey);
      },
    });
  }
}
