import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { ApiError } from '../../../../core/models/api-error';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIconButton } from '../../../../shared/components/ui-icon-button/ui-icon-button';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { SignupProgress } from '../../components/signup-progress/signup-progress';
import { AccountStep } from '../../components/steps/account-step/account-step';
import { ActivityStep } from '../../components/steps/activity-step/activity-step';
import { BirthdayStep } from '../../components/steps/birthday-step/birthday-step';
import { GenderStep } from '../../components/steps/gender-step/gender-step';
import { GoalStep } from '../../components/steps/goal-step/goal-step';
import { GoalWeightStep } from '../../components/steps/goal-weight-step/goal-weight-step';
import { HeightStep } from '../../components/steps/height-step/height-step';
import { NotificationsStep } from '../../components/steps/notifications-step/notifications-step';
import { PaceStep } from '../../components/steps/pace-step/pace-step';
import { SummaryStep } from '../../components/steps/summary-step/summary-step';
import { TrainingDurationStep } from '../../components/steps/training-duration-step/training-duration-step';
import { TrainingFrequencyStep } from '../../components/steps/training-frequency-step/training-frequency-step';
import { TrainingIntensityStep } from '../../components/steps/training-intensity-step/training-intensity-step';
import { WeightStep } from '../../components/steps/weight-step/weight-step';
import { SignupStateService } from '../../services/signup-state';

/** The design has no error state here – the text is our own, in the design's tone. */
const SUBMIT_ERROR_MESSAGE_KEY = 'signup.page.submitError';

/** The key of the error to show; the page translates it live, so it follows a language switch. */
function errorMessageKey(error: unknown): string {
  const messageKey = (error as Partial<ApiError> | null)?.messageKey;
  return typeof messageKey === 'string' && messageKey.length > 0
    ? messageKey
    : SUBMIT_ERROR_MESSAGE_KEY;
}

/**
 * The signup flow's only page: progress at the top, the active step in the middle and
 * back/next at the bottom. The steps fetch their own data from `SignupStateService`.
 */
@Component({
  selector: 'app-signup-page',
  imports: [
    TranslatePipe,
    UiButton,
    UiFormError,
    UiIcon,
    UiIconButton,
    SignupProgress,
    AccountStep,
    ActivityStep,
    BirthdayStep,
    GenderStep,
    GoalStep,
    GoalWeightStep,
    HeightStep,
    NotificationsStep,
    PaceStep,
    SummaryStep,
    TrainingDurationStep,
    TrainingFrequencyStep,
    TrainingIntensityStep,
    WeightStep,
  ],
  templateUrl: './signup-page.html',
  styleUrl: './signup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'signup-page' },
})
export class SignupPage {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);
  /** Above the on-screen keyboard the progress header slims down, so the fields keep the room. */
  protected readonly keyboardOpen = inject(KeyboardService).isOpen;
  protected readonly submitting = signal(false);
  private readonly errorKey = signal<string | null>(null);
  protected readonly error = computed(() => {
    const key = this.errorKey();
    return key === null ? null : this.t(key);
  });

  /** On the summary, the button creates the account – otherwise it just moves on. */
  protected onNext(): void {
    if (this.state.step() !== 'summary') {
      this.state.next();
      return;
    }
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.errorKey.set(null);
    this.state
      .submit()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitting.set(false);
          void this.router.navigateByUrl(APP_PATH.HOME);
        },
        error: (error: unknown) => {
          this.submitting.set(false);
          this.errorKey.set(errorMessageKey(error));
        },
      });
  }
}
