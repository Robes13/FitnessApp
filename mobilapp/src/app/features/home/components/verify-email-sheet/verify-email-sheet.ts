import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NutritionCalculator } from '../../../../core/services/nutrition-calculator';
import { SessionService } from '../../../../core/services/session';
import { UserProfileService } from '../../../../core/services/user-profile';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { UiTextInput } from '../../../../shared/components/ui-text-input/ui-text-input';

interface VerifyEmailForm {
  email: FormControl<string>;
}

/** Shown in place of the address if the profile doesn't have an e-mail yet. */
const EMAIL_FALLBACK = 'din mail';
const INVALID_EMAIL_MESSAGE = 'Skriv en gyldig e-mail.';
const REQUEST_FAILED_MESSAGE = 'Noget gik galt. Prøv igen.';
/** One extra rotation per check, matching the design's `refreshRot`. */
const ROTATION_PER_CHECK_DEG = 360;
/**
 * "Tjek din mail" – the sheet that locks Home until the e-mail is verified. It cannot be
 * dismissed (`hideClose`): neither the scrim, Escape, nor a close button dismiss it.
 *
 * The user can correct their e-mail, request a new code, and press "Tjek igen". All three
 * actions go through `SessionService`; until a backend exists, `AuthApi` answers with stubs.
 */
@Component({
  selector: 'app-verify-email-sheet',
  imports: [ReactiveFormsModule, UiButton, UiFormError, UiIcon, UiSheet, UiTextInput],
  templateUrl: './verify-email-sheet.html',
  styleUrl: './verify-email-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailSheet {
  readonly open = input.required<boolean>();

  private readonly session = inject(SessionService);
  private readonly profileService = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form = new FormGroup<VerifyEmailForm>({
    email: new FormControl('', { nonNullable: true }),
  });

  private readonly emailValue = toSignal(this.form.controls.email.valueChanges, {
    initialValue: '',
  });

  protected readonly editingEmail = signal(false);
  protected readonly saving = signal(false);
  protected readonly resending = signal(false);
  protected readonly resent = signal(false);
  protected readonly checking = signal(false);
  protected readonly failedChecks = signal(0);
  protected readonly rotationDeg = signal(0);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly emailLabel = computed(
    () => this.profileService.profile().email.trim() || EMAIL_FALLBACK,
  );
  protected readonly emailInvalid = computed(() => {
    const value = this.emailValue().trim();
    return value.length > 3 && !this.calculator.isValidEmail(value);
  });
  protected readonly resendLabel = computed(() =>
    this.resent() ? 'Kode sendt ✓' : 'Gensend kode',
  );
  protected readonly resendHint = computed(() =>
    this.resent() ? 'Ny kode sendt – tjek også spam.' : 'Ikke modtaget noget?',
  );
  protected readonly checkLabel = computed(() => {
    if (this.checking()) {
      return 'Tjekker…';
    }
    return this.failedChecks() > 0 ? 'Ikke bekræftet' : 'Tjek igen';
  });
  protected readonly rotation = computed(() => `${this.rotationDeg()}deg`);

  protected toggleEmailEditor(): void {
    const opening = !this.editingEmail();
    if (opening) {
      this.form.controls.email.setValue(this.profileService.profile().email);
    }
    this.errorMessage.set(null);
    this.editingEmail.set(opening);
  }

  protected saveEmail(): void {
    const email = this.form.controls.email.value.trim();
    if (!this.calculator.isValidEmail(email)) {
      this.errorMessage.set(INVALID_EMAIL_MESSAGE);
      return;
    }
    this.profileService.update({ email });
    this.editingEmail.set(false);
    this.errorMessage.set(null);
    this.saving.set(true);
    this.session
      .resendVerification()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.resent.set(true);
        },
        error: () => {
          this.saving.set(false);
          this.errorMessage.set(REQUEST_FAILED_MESSAGE);
        },
      });
  }

  protected resend(): void {
    this.errorMessage.set(null);
    this.resending.set(true);
    this.session
      .resendVerification()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.resending.set(false);
          this.resent.set(true);
          // TODO: remove once the auth API exists – without a backend no e-mail is sent, so
          // "Gensend kode" unlocks Home directly. The real flow verifies via `check()`.
          this.session.markEmailVerified();
        },
        error: () => {
          this.resending.set(false);
          this.errorMessage.set(REQUEST_FAILED_MESSAGE);
        },
      });
  }

  protected check(): void {
    if (this.checking()) {
      return;
    }
    this.errorMessage.set(null);
    this.checking.set(true);
    this.rotationDeg.update((degrees) => degrees + ROTATION_PER_CHECK_DEG);
    this.session
      .checkVerification()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (verified) => {
          this.checking.set(false);
          if (!verified) {
            this.failedChecks.update((count) => count + 1);
          }
        },
        error: () => {
          this.checking.set(false);
          this.errorMessage.set(REQUEST_FAILED_MESSAGE);
        },
      });
  }
}
