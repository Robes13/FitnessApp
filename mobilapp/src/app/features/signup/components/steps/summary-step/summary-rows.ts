import { GENDERS, GOALS, PACES } from '../../../../../core/constants/nutrition';
import { Gender, GoalId, IntensityDefinition, PaceId } from '../../../../../core/models/profile';
import { formatInteger, formatWeightKg } from '../../../../../core/utils/date-format';
import { SignupStepId } from '../../../services/signup-state';

/** A single line in the summary. `step` is the step the line sends the user back to. */
export interface SummaryRow {
  readonly step: SignupStepId;
  readonly label: string;
  readonly value: string;
  /** Only "Goal" is highlighted with an orange value, as in the design. */
  readonly accent: boolean;
}

/** The draft the summary reads from — already-derived values, not raw signals. */
export interface SummaryDraft {
  readonly username: string;
  readonly age: number;
  readonly gender: Gender | null;
  readonly weightKg: number;
  readonly heightCm: number;
  readonly stepsPerDay: number;
  readonly activityLabel: string;
  readonly trainingDayCount: number;
  readonly trainingMinutes: number;
  readonly intensity: IntensityDefinition | null;
  readonly goal: GoalId | null;
  /** The goal weight clamped within the scale's bounds (the design's `goalW`). */
  readonly goalWeightKg: number;
  readonly pace: PaceId | null;
  readonly notifications: boolean | null;
}

const EMPTY = '–';
const NO_TRAINING = 'Ingen faste træninger';
const NOTIFICATIONS_YES = 'Ja tak';
const NOTIFICATIONS_NO = 'Nej tak';
const GOAL_STEP: SignupStepId = 'goal';

function genderLabel(gender: Gender | null): string {
  return GENDERS.find((candidate) => candidate.id === gender)?.label ?? EMPTY;
}

/** `Lose weight · 70 kg · moderate` – the goal weight is omitted for "maintain weight". */
function goalLabel(draft: SummaryDraft): string {
  const goal = GOALS.find((candidate) => candidate.id === draft.goal);
  if (!goal) {
    return EMPTY;
  }
  const weight = draft.goal === 'hold' ? '' : ` · ${Math.round(draft.goalWeightKg)} kg`;
  const pace = PACES.find((candidate) => candidate.id === draft.pace);
  const paceSuffix = pace ? ` · ${pace.label.toLowerCase()}` : '';
  return `${goal.label}${weight}${paceSuffix}`;
}

/** `3 × 45 min · moderate` – or "No fixed workouts", when no days are selected. */
function trainingLabel(draft: SummaryDraft): string {
  if (draft.trainingDayCount === 0) {
    return NO_TRAINING;
  }
  const intensity = draft.intensity ? ` · ${draft.intensity.label.toLowerCase()}` : '';
  return `${draft.trainingDayCount} × ${draft.trainingMinutes} min${intensity}`;
}

function notificationsLabel(notifications: boolean | null): string {
  if (notifications === null) {
    return EMPTY;
  }
  return notifications ? NOTIFICATIONS_YES : NOTIFICATIONS_NO;
}

/**
 * The design's `sumRows`: nine lines in the same order as the flow. The function is pure, so it
 * can be tested without instantiating the component.
 */
export function buildSummaryRows(draft: SummaryDraft): readonly SummaryRow[] {
  const rows: readonly Omit<SummaryRow, 'accent'>[] = [
    { step: 'account', label: 'Bruger', value: draft.username || EMPTY },
    { step: 'birthday', label: 'Alder', value: draft.age > 0 ? `${draft.age} år` : EMPTY },
    { step: 'gender', label: 'Køn', value: genderLabel(draft.gender) },
    { step: 'weight', label: 'Vægt', value: `${formatWeightKg(draft.weightKg)} kg` },
    { step: 'height', label: 'Højde', value: `${draft.heightCm} cm` },
    {
      step: 'activity',
      label: 'Aktivitet',
      value: `${formatInteger(draft.stepsPerDay)} skridt · ${draft.activityLabel}`,
    },
    { step: 'training-frequency', label: 'Træning', value: trainingLabel(draft) },
    { step: GOAL_STEP, label: 'Mål', value: goalLabel(draft) },
    {
      step: 'notifications',
      label: 'Påmindelser',
      value: notificationsLabel(draft.notifications),
    },
  ];
  return rows.map((row) => ({ ...row, accent: row.step === GOAL_STEP }));
}
