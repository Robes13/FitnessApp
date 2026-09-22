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

/** Vist i stedet for adressen, hvis profilen endnu ikke har en e-mail. */
const EMAIL_FALLBACK = 'din mail';
const INVALID_EMAIL_MESSAGE = 'Skriv en gyldig e-mail.';
const REQUEST_FAILED_MESSAGE = 'Noget gik galt. Prøv igen.';
/** Ét ekstra omdrejning pr. tjek, som designets `refreshRot`. */
const ROTATION_PER_CHECK_DEG = 360;
/** Efter så mange forgæves tjek tilbydes demo-genvejen "Fortsæt uden bekræftelse". */
const CHECKS_BEFORE_SKIP = 2;

/**
 * "Tjek din mail" – arket, der låser Hjem, indtil e-mailen er bekræftet. Det kan ikke
 * lukkes (`hideClose`): hverken scrim, Escape eller en luk-knap afviser det.
 *
 * Brugeren kan rette sin mail, få en ny kode og trykke "Tjek igen". `AuthApi` er en attrap,
 * der altid svarer "ikke bekræftet", så efter to forgæves tjek vises **demo-genvejen**
 * "Fortsæt uden bekræftelse", der markerer mailen som bekræftet lokalt. Den skal fjernes,
 * når der kommer en rigtig backend.
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
  protected readonly showSkip = computed(() => this.failedChecks() >= CHECKS_BEFORE_SKIP);

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

  /** Demo-genvej: låser appen op uden en rigtig bekræftelse. */
  protected continueWithoutVerification(): void {
    this.session.markEmailVerified();
  }
}
