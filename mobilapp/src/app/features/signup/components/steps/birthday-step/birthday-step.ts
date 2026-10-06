import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { MAX_AGE, MIN_AGE } from '../../../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../../../core/services/nutrition-calculator/nutrition-calculator';
import { startOfDay, toIsoDate } from '../../../../../core/utils/date-format';
import { NOW } from '../../../../../core/utils/now';
import { bandToneForGender } from '../../../../../shared/components/figure';
import { UiTextInput } from '../../../../../shared/components/ui-text-input/ui-text-input';
import { SignupStateService } from '../../../services/signup-state';
import { BirthdayCake } from './birthday-cake/birthday-cake';
import { injectTranslate } from '../../../../../core/services/language/translate';

/** The design's `ageHint`. */
const HINT_NO_DATE_KEY = 'signup.birthdayStep.hintNoDate';
const HINT_TOO_YOUNG_KEY = 'signup.birthdayStep.hintTooYoung';
const HINT_TOO_OLD_KEY = 'signup.birthdayStep.hintTooOld';
const AGE_PLACEHOLDER = '–';

/**
 * Step 2 (`sAlder`): the birthday is picked in the device's native date field. The age is
 * shown large and used in the BMR calculation, and `app-birthday-cake` reacts to it with hat,
 * flames and cake tiers.
 */
@Component({
  selector: 'app-birthday-step',
  imports: [BirthdayCake, ReactiveFormsModule, TranslatePipe, UiTextInput],
  templateUrl: './birthday-step.html',
  styleUrl: './birthday-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'birthday-step' },
})
export class BirthdayStep {
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);

  /** `''` while the native field is empty or incomplete. */
  protected readonly dateControl = new FormControl(this.state.birthday() ?? '', {
    nonNullable: true,
  });

  private readonly today = computed(() => startOfDay(this.now()));
  protected readonly maxDate = computed(() => toIsoDate(this.today()));
  /** The oldest birthday the API accepts – `MAX_AGE` years today. */
  protected readonly minDate = computed(() => {
    const today = this.today();
    return toIsoDate(
      new Date(today.getFullYear() - MAX_AGE - 1, today.getMonth(), today.getDate() + 1),
    );
  });

  protected readonly age = computed(() =>
    this.calculator.ageFromBirthday(this.state.birthday(), this.now()),
  );
  protected readonly ageText = computed(() =>
    this.age() > 0 ? String(this.age()) : AGE_PLACEHOLDER,
  );

  protected readonly ageHint = computed(() => {
    if (!this.state.birthday()) {
      return this.t(HINT_NO_DATE_KEY);
    }
    const age = this.age();
    if (age < MIN_AGE) {
      return this.t(HINT_TOO_YOUNG_KEY, { minAge: MIN_AGE });
    }
    return age > MAX_AGE ? this.t(HINT_TOO_OLD_KEY) : '';
  });

  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));

  constructor() {
    this.dateControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((date) => this.state.birthday.set(date || null));
  }
}
