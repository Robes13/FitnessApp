import { GENDERS, GOALS, PACES } from '../../../../../core/constants/nutrition';
import { Gender, GoalId, IntensityDefinition, PaceId } from '../../../../../core/models/profile';
import { formatInteger, formatWeightKg } from '../../../../../core/utils/date-format';
import { Translate } from '../../../../../core/services/language/translate';
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
const NO_TRAINING_KEY = 'signup.summaryRows.noTraining';
const NOTIFICATIONS_YES_KEY = 'signup.notificationsStep.yes';
const NOTIFICATIONS_NO_KEY = 'signup.notificationsStep.no';
const GOAL_STEP: SignupStepId = 'goal';

function genderLabel(t: Translate, gender: Gender | null): string {
  const definition = GENDERS.find((candidate) => candidate.id === gender);
  return definition ? t(definition.labelKey) : EMPTY;
}

/** `Lose weight · 70 kg · moderate` – the goal weight is omitted for "maintain weight". */
function goalLabel(t: Translate, draft: SummaryDraft): string {
  const goal = GOALS.find((candidate) => candidate.id === draft.goal);
  if (!goal) {
    return EMPTY;
  }
  const parts = [t(goal.labelKey)];
  if (draft.goal !== 'hold') {
    parts.push(t('signup.summaryRows.weightValue', { weight: Math.round(draft.goalWeightKg) }));
  }
  const pace = PACES.find((candidate) => candidate.id === draft.pace);
  if (pace) {
    parts.push(t(pace.labelKey).toLowerCase());
  }
  return parts.join(' · ');
}

/** `3 × 45 min · moderate` – or "No fixed workouts", when no days are selected. */
function trainingLabel(t: Translate, draft: SummaryDraft): string {
  if (draft.trainingDayCount === 0) {
    return t(NO_TRAINING_KEY);
  }
  const schedule = t('signup.summaryRows.trainingSchedule', {
    days: draft.trainingDayCount,
    minutes: draft.trainingMinutes,
  });
  return draft.intensity ? `${schedule} · ${t(draft.intensity.labelKey).toLowerCase()}` : schedule;
}

function notificationsLabel(t: Translate, notifications: boolean | null): string {
  if (notifications === null) {
    return EMPTY;
  }
  return t(notifications ? NOTIFICATIONS_YES_KEY : NOTIFICATIONS_NO_KEY);
}

/**
 * The design's `sumRows`: nine lines in the same order as the flow. The function is pure, so it
 * can be tested without instantiating the component.
 */
export function buildSummaryRows(t: Translate, draft: SummaryDraft): readonly SummaryRow[] {
  const rows: readonly Omit<SummaryRow, 'accent'>[] = [
    { step: 'account', label: t('signup.summaryRows.user'), value: draft.username || EMPTY },
    {
      step: 'birthday',
      label: t('signup.summaryRows.age'),
      value: draft.age > 0 ? t('signup.summaryRows.ageValue', { age: draft.age }) : EMPTY,
    },
    { step: 'gender', label: t('signup.summaryRows.gender'), value: genderLabel(t, draft.gender) },
    {
      step: 'weight',
      label: t('signup.summaryRows.weight'),
      value: t('signup.summaryRows.weightValue', { weight: formatWeightKg(draft.weightKg) }),
    },
    {
      step: 'height',
      label: t('signup.summaryRows.height'),
      value: t('signup.summaryRows.heightValue', { height: draft.heightCm }),
    },
    {
      step: 'activity',
      label: t('signup.summaryRows.activity'),
      value: t('signup.summaryRows.activityValue', {
        steps: formatInteger(draft.stepsPerDay),
        activity: draft.activityLabel,
      }),
    },
    {
      step: 'training-frequency',
      label: t('signup.summaryRows.training'),
      value: trainingLabel(t, draft),
    },
    { step: GOAL_STEP, label: t('signup.summaryRows.goal'), value: goalLabel(t, draft) },
    {
      step: 'notifications',
      label: t('signup.summaryRows.notifications'),
      value: notificationsLabel(t, draft.notifications),
    },
  ];
  return rows.map((row) => ({ ...row, accent: row.step === GOAL_STEP }));
}
