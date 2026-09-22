import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { DEFAULT_DISPLAY_NAME, DEMO_PROFILE_DEFAULTS } from '../constants/demo-data';
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
 * Brugerens profil som ét signal plus afledte værdier (alder, BMI, kaloriemål …).
 * Gemmes i storage ved hver ændring. Manglende felter i en gemt profil udfyldes fra
 * `DEMO_PROFILE_DEFAULTS`, så ældre data stadig kan læses.
 */
@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly storage = inject(StorageService);
  private readonly calculator = inject(NutritionCalculator);
  private readonly now = inject(NOW);
  private readonly state = signal<UserProfile>(this.restore());

  readonly profile: Signal<UserProfile> = this.state.asReadonly();
  readonly displayName = computed(() => this.state().username.trim() || DEFAULT_DISPLAY_NAME);
  readonly initial = computed(() => this.displayName().charAt(0).toUpperCase());
  readonly age = computed(() => this.calculator.ageFromBirthday(this.state().birthday, this.now()));
  readonly bmi = computed(() => this.calculator.bmi(this.state().weightKg, this.state().heightCm));
  readonly kcalTarget = computed(() => this.calculator.kcalTarget(this.state(), this.now()));
  readonly suggestedKcalTarget = computed(() =>
    this.calculator.suggestedKcalTarget(this.state(), this.now()),
  );
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

  resetToDefaults(): void {
    this.replace({ ...DEMO_PROFILE_DEFAULTS });
  }

  private restore(): UserProfile {
    const stored = this.storage.read<Partial<UserProfile>>(STORAGE_KEY.PROFILE);
    return stored ? { ...DEMO_PROFILE_DEFAULTS, ...stored } : { ...DEMO_PROFILE_DEFAULTS };
  }
}
