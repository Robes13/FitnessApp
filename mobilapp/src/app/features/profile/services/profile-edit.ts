import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  GENDERS,
  GOALS,
  INTENSITIES,
  KCAL_MAX,
  KCAL_MIN,
  PACES,
  STEPS_MAX,
  STEPS_MIN,
  TRAINING_MAX_MINUTES,
  TRAINING_MIN_MINUTES,
  UNIT_SYSTEMS,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from '../../../core/constants/nutrition';
import { AuthApi } from '../../../core/services/auth-api';
import { UserProfileService } from '../../../core/services/user-profile';
import { formatInteger, formatWeightKg } from '../../../core/utils/date-format';

/** The rows in Profile that can be edited. The ids are the design's `editDefs` keys. */
export const PROFILE_EDIT_ROWS = [
  'goal',
  'pace',
  'gender',
  'height',
  'goalWeight',
  'steps',
  'trainFreq',
  'trainDur',
  'trainInt',
  'kcal',
  'email',
  'password',
  'units',
] as const;

export type ProfileEditRowId = (typeof PROFILE_EDIT_ROWS)[number];

export interface ProfileEditOption {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

interface BaseEditDefinition {
  readonly id: ProfileEditRowId;
  readonly title: string;
  /** Empty string = no hint text. */
  readonly hint: string;
}

export interface OptionsEditDefinition extends BaseEditDefinition {
  readonly kind: 'options';
  readonly options: readonly ProfileEditOption[];
  readonly selectedId: string | null;
}

export interface NumberEditDefinition extends BaseEditDefinition {
  readonly kind: 'number';
  readonly unit: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
}

export interface TextEditDefinition extends BaseEditDefinition {
  readonly kind: 'text';
  readonly placeholder: string;
  readonly value: string;
}

export interface PasswordEditDefinition extends BaseEditDefinition {
  readonly kind: 'password';
}

export type ProfileEditDefinition =
  OptionsEditDefinition | NumberEditDefinition | TextEditDefinition | PasswordEditDefinition;

/**
 * The design's `editDefs` uses a narrower height range than the ruler in the sign-up flow
 * (`HEIGHT_MIN_CM`/`HEIGHT_MAX_CM`), because this field is typed with the keyboard.
 */
const HEIGHT_EDIT_MIN_CM = 120;
const HEIGHT_EDIT_MAX_CM = 230;

const HEIGHT_STEP_CM = 1;
const GOAL_WEIGHT_STEP_KG = 1;
const STEPS_STEP = 500;
const TRAINING_DAYS_PER_WEEK = 7;
const TRAINING_FREQUENCY_STEP = 1;
const TRAINING_MINUTES_STEP = 5;
const KCAL_STEP = 50;

const EMAIL_PLACEHOLDER = 'dig@mail.dk';

/**
 * The definitions behind the "Rediger profil" sheet: what a row is called, what kind of
 * field it shows, and what happens when the user saves. A port of the design's
 * `editDefs`/`openEdit`.
 *
 * The password isn't part of the profile, so it's sent to `AuthApi.resetPassword()` – the
 * backend is the only place a password can be changed.
 */
@Injectable({ providedIn: 'root' })
export class ProfileEditService {
  private readonly profiles = inject(UserProfileService);
  private readonly authApi = inject(AuthApi);

  definitionFor(row: ProfileEditRowId): ProfileEditDefinition {
    const profile = this.profiles.profile();
    switch (row) {
      case 'goal':
        return {
          id: row,
          title: 'Dit mål',
          hint: '',
          kind: 'options',
          selectedId: profile.goal,
          options: GOALS.map((goal) => ({
            id: goal.id,
            label: goal.label,
            description: goal.description,
          })),
        };
      case 'pace':
        return {
          id: row,
          title: 'Tempo',
          hint: '',
          kind: 'options',
          selectedId: profile.pace,
          options: PACES.map((pace) => ({
            id: pace.id,
            label: pace.label,
            description: `${pace.rateLabel} · ${pace.description}`,
          })),
        };
      case 'gender':
        return {
          id: row,
          title: 'Køn',
          hint: '',
          kind: 'options',
          selectedId: profile.gender,
          options: GENDERS.map((gender) => ({
            id: gender.id,
            label: gender.label,
            description: '',
          })),
        };
      case 'units':
        return {
          id: row,
          title: 'Enheder',
          hint: '',
          kind: 'options',
          selectedId: profile.units,
          options: UNIT_SYSTEMS.map((unit) => ({
            id: unit.id,
            label: unit.label,
            description: unit.description,
          })),
        };
      case 'trainInt':
        return {
          id: row,
          title: 'Intensitet',
          hint: '',
          kind: 'options',
          selectedId: this.profiles.intensity()?.id ?? null,
          options: INTENSITIES.map((intensity) => ({
            id: intensity.id,
            label: intensity.label,
            description: intensity.talkTest,
          })),
        };
      case 'height':
        return {
          id: row,
          title: 'Højde',
          hint: '',
          kind: 'number',
          unit: 'cm',
          min: HEIGHT_EDIT_MIN_CM,
          max: HEIGHT_EDIT_MAX_CM,
          step: HEIGHT_STEP_CM,
          value: Math.round(profile.heightCm),
        };
      case 'goalWeight':
        return {
          id: row,
          title: 'Målvægt',
          hint: `Nu: ${formatWeightKg(profile.weightKg)} kg`,
          kind: 'number',
          unit: 'kg',
          min: WEIGHT_MIN_KG,
          max: WEIGHT_MAX_KG,
          step: GOAL_WEIGHT_STEP_KG,
          value: Math.round(profile.goalWeightKg),
        };
      case 'steps':
        return {
          id: row,
          title: 'Skridt om dagen',
          hint: 'Dit typiske dagligt niveau',
          kind: 'number',
          unit: 'skridt',
          min: STEPS_MIN,
          max: STEPS_MAX,
          step: STEPS_STEP,
          value: Math.round(profile.stepsPerDay),
        };
      case 'trainFreq':
        return {
          id: row,
          title: 'Træningsdage',
          hint: 'Faste træninger om ugen',
          kind: 'number',
          unit: '/ uge',
          min: 0,
          max: TRAINING_DAYS_PER_WEEK,
          step: TRAINING_FREQUENCY_STEP,
          value: this.profiles.trainingFrequency(),
        };
      case 'trainDur':
        return {
          id: row,
          title: 'Længde pr. træning',
          hint: '',
          kind: 'number',
          unit: 'min',
          min: TRAINING_MIN_MINUTES,
          max: TRAINING_MAX_MINUTES,
          step: TRAINING_MINUTES_STEP,
          value: Math.round(profile.trainingMinutes),
        };
      case 'kcal':
        return {
          id: row,
          title: 'Dagligt kaloriemål',
          hint: `Beregnet forslag: ${formatInteger(this.profiles.suggestedKcalTarget())} kcal`,
          kind: 'number',
          unit: 'kcal',
          min: KCAL_MIN,
          max: KCAL_MAX,
          step: KCAL_STEP,
          value: this.profiles.kcalTarget(),
        };
      case 'email':
        return {
          id: row,
          title: 'E-mail',
          hint: '',
          kind: 'text',
          placeholder: EMAIL_PLACEHOLDER,
          value: profile.email,
        };
      case 'password':
        return { id: row, title: 'Ny adgangskode', hint: 'Mindst 8 tegn', kind: 'password' };
    }
  }

  /**
   * A choice in an options sheet is saved immediately, as in the design. The id is looked
   * up in the definition list, so an unknown string can never end up in the profile.
   */
  applyOption(row: ProfileEditRowId, optionId: string): void {
    switch (row) {
      case 'goal': {
        const goal = GOALS.find((item) => item.id === optionId);
        if (goal) {
          this.profiles.update({ goal: goal.id });
        }
        return;
      }
      case 'pace': {
        const pace = PACES.find((item) => item.id === optionId);
        if (pace) {
          this.profiles.update({ pace: pace.id });
        }
        return;
      }
      case 'gender': {
        const gender = GENDERS.find((item) => item.id === optionId);
        if (gender) {
          this.profiles.update({ gender: gender.id });
        }
        return;
      }
      case 'units': {
        const units = UNIT_SYSTEMS.find((item) => item.id === optionId);
        if (units) {
          this.profiles.update({ units: units.id });
        }
        return;
      }
      case 'trainInt': {
        const intensity = INTENSITIES.find((item) => item.id === optionId);
        if (intensity) {
          this.profiles.update({ trainingRpe: intensity.rpe });
        }
        return;
      }
      default:
        return;
    }
  }

  applyNumber(row: ProfileEditRowId, value: number): void {
    const rounded = Math.round(value);
    switch (row) {
      case 'height':
        this.profiles.update({ heightCm: rounded });
        return;
      case 'goalWeight':
        this.profiles.update({ goalWeightKg: rounded });
        return;
      case 'steps':
        this.profiles.update({ stepsPerDay: rounded });
        return;
      case 'trainFreq':
        this.profiles.update({ trainingDays: trainingDaysFor(rounded) });
        return;
      case 'trainDur':
        this.profiles.update({ trainingMinutes: rounded });
        return;
      case 'kcal':
        this.profiles.update({ kcalOverride: rounded });
        return;
      default:
        return;
    }
  }

  applyEmail(value: string): void {
    this.profiles.update({ email: value.trim() });
  }

  changePassword(password: string): Observable<void> {
    return this.authApi.resetPassword(password);
  }
}

/** The design's `trainFreq.apply`: the first `count` weekdays are marked as training days. */
function trainingDaysFor(count: number): readonly boolean[] {
  return Array.from({ length: TRAINING_DAYS_PER_WEEK }, (_, index) => index < count);
}
