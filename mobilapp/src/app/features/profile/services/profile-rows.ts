import { Injectable, Signal, computed, inject } from '@angular/core';
import { GENDERS, UNIT_SYSTEMS } from '../../../core/constants/nutrition';
import { NutritionCalculator } from '../../../core/services/nutrition-calculator';
import { UserProfileService } from '../../../core/services/user-profile';
import { formatDecimal, formatInteger, formatWeightKg } from '../../../core/utils/date-format';
import { clamp } from '../../../core/utils/math';

import { ProfileEditRowId } from './profile-edit';

export interface ProfileRow {
  readonly id: ProfileEditRowId;
  readonly label: string;
  readonly value: string;
}

/** Designets `'–'` for en værdi, brugeren endnu ikke har valgt. */
const EMPTY_VALUE = '–';
const PASSWORD_MASK = '••••••••';

/**
 * Rækkerne under "Min plan" og "Konto" på profilsiden – designets `profileRows` og
 * `accountRows`.
 *
 * Tre rækker er betingede, præcis som i designet: "Målvægt" vises kun, når målet ikke er
 * "holde vægten", og "Længde"/"Intensitet" kun, når brugeren har mindst én træningsdag.
 */
@Injectable({ providedIn: 'root' })
export class ProfileRowsService {
  private readonly profiles = inject(UserProfileService);
  private readonly calculator = inject(NutritionCalculator);

  readonly planRows: Signal<readonly ProfileRow[]> = computed(() => {
    const profile = this.profiles.profile();
    const goal = this.profiles.goalDefinition();
    const pace = this.profiles.paceDefinition();
    const frequency = this.profiles.trainingFrequency();
    const rows: ProfileRow[] = [
      { id: 'goal', label: 'Mål', value: goal?.label ?? EMPTY_VALUE },
      { id: 'pace', label: 'Tempo', value: pace?.rateLabel ?? EMPTY_VALUE },
      { id: 'gender', label: 'Køn', value: this.genderLabel() },
      { id: 'height', label: 'Højde', value: `${Math.round(profile.heightCm)} cm` },
    ];
    if (profile.goal !== null && profile.goal !== 'hold') {
      rows.push({ id: 'goalWeight', label: 'Målvægt', value: `${this.goalWeightKg()} kg` });
    }
    rows.push(
      {
        id: 'steps',
        label: 'Aktivitet',
        value: `${formatInteger(profile.stepsPerDay)} skridt · ${this.profiles.activityLevel().label}`,
      },
      {
        id: 'trainFreq',
        label: 'Træningsdage',
        value: frequency === 0 ? 'Ingen' : `${frequency} / uge`,
      },
    );
    if (frequency > 0) {
      rows.push(
        { id: 'trainDur', label: 'Længde', value: `${Math.round(profile.trainingMinutes)} min` },
        {
          id: 'trainInt',
          label: 'Intensitet',
          value: this.profiles.intensity()?.label ?? EMPTY_VALUE,
        },
      );
    }
    rows.push({
      id: 'kcal',
      label: 'Dagligt kaloriemål',
      value: `${formatInteger(this.profiles.kcalTarget())} kcal`,
    });
    return rows;
  });

  readonly accountRows: Signal<readonly ProfileRow[]> = computed(() => [
    { id: 'email' as const, label: 'E-mail', value: this.email() },
    { id: 'password' as const, label: 'Adgangskode', value: PASSWORD_MASK },
    { id: 'units' as const, label: 'Enheder', value: this.unitsLabel() },
  ]);

  /** Designets `profileEmail`: pladsholderen vises, indtil brugeren har skrevet sin mail. */
  readonly email = computed(() => this.profiles.profile().email || 'dig@mail.dk');

  readonly weightText = computed(() => formatWeightKg(this.profiles.profile().weightKg));
  readonly heightText = computed(() => String(Math.round(this.profiles.profile().heightCm)));
  /** BMI vises altid med én decimal – designets `toFixed(1)`. */
  readonly bmiText = computed(() => formatDecimal(this.profiles.bmi(), 1));

  private readonly genderLabel = computed(() => {
    const gender = this.profiles.profile().gender;
    return GENDERS.find((item) => item.id === gender)?.label ?? EMPTY_VALUE;
  });

  private readonly unitsLabel = computed(() => {
    const units = this.profiles.profile().units;
    return UNIT_SYSTEMS.find((item) => item.id === units)?.description ?? EMPTY_VALUE;
  });

  /** Målvægten holdes inden for de grænser, målet tillader (designets `gMin`/`gMax`). */
  private readonly goalWeightKg = computed(() => {
    const profile = this.profiles.profile();
    const bounds = this.calculator.goalWeightBounds(profile.goal, profile.weightKg);
    return Math.round(clamp(profile.goalWeightKg, bounds.min, bounds.max));
  });
}
