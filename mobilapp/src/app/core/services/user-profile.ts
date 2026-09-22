import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { DEFAULT_PROFILE } from '../constants/profile-defaults';
import { GOALS } from '../constants/nutrition';
import { STORAGE_KEY } from '../constants/storage-key';
import {
  ActivityLevel,
  GoalDefinition,
  IntensityDefinition,
  PaceDefinition,
  UserProfile,
} from '../models/profile';
import { NOW } from '../utils/now';
import { NutritionCalculator } from './nutrition-calculator';
import { StorageService } from './storage';

/**
 * The user's profile as one signal plus derived values (age, BMI, activity level …). The
 * calorie target lives in `AdaptiveGoalService`, which also accounts for the logged intake
 * and weight trend.
 * Saved to storage on every change. Missing fields in a saved profile are filled in from
 * `DEFAULT_PROFILE`, so older data can still be read.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly storage = inject(StorageService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly state = signal<UserProfile>(this.restore());

  readonly profile: Signal<UserProfile> = this.state.asReadonly();
  /** The user's own name. Empty until the user has signed up or logged in. */
  readonly displayName = computed(() => this.state().username.trim());
  readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());
  readonly age = computed(() => this.calculator.ageFromBirthday(this.state().birthday, this.now()));
  readonly bmi = computed(() => this.calculator.bmi(this.state().weightKg, this.state().heightCm));
  readonly activityLevel: Signal<ActivityLevel> = computed(() =>
    this.calculator.activityLevelFor(this.state().stepsPerDay),
  );
  readonly trainingFrequency = computed(() => this.calculator.trainingFrequency(this.state()));
  readonly intensity: Signal<IntensityDefinition | null> = computed(() =>
    this.calculator.intensityFor(this.state().trainingRpe),
  );
  readonly goalDefinition: Signal<GoalDefinition | null> = computed(
    () => GOALS.find((goal) => goal.id === this.state().goal) ?? null,
  );
  readonly paceDefinition: Signal<PaceDefinition | null> = computed(() =>
    this.calculator.paceFor(this.state().pace),
  );

  update(patch: Partial<UserProfile>): void {
    this.replace({ ...this.state(), ...patch });
  }

  replace(profile: UserProfile): void {
    this.state.set(profile);
    this.storage.write(STORAGE_KEY.PROFILE, profile);
  }

  /** Applies a change only after it has been persisted successfully. */
  updatePersisted(patch: Partial<UserProfile>): boolean {
    const profile = { ...this.state(), ...patch };
    if (!this.storage.write(STORAGE_KEY.PROFILE, profile)) {
      return false;
    }
    this.state.set(profile);
    return true;
  }

  resetToDefaults(): void {
    this.replace({ ...DEFAULT_PROFILE });
  }

  private restore(): UserProfile {
    const stored = this.storage.read<Partial<UserProfile>>(STORAGE_KEY.PROFILE);
    return stored ? { ...DEFAULT_PROFILE, ...stored } : { ...DEFAULT_PROFILE };
  }
}
