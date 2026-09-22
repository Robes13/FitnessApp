import { GENDERS, GOALS, PACES } from '../../../../../core/constants/nutrition';
import { Gender, GoalId, IntensityDefinition, PaceId } from '../../../../../core/models/profile';
import { formatInteger, formatWeightKg } from '../../../../../core/utils/date-format';
import { SignupStepId } from '../../../services/signup-state';

/** Én linje i opsummeringen. `step` er det trin, linjen sender brugeren tilbage til. */
export interface SummaryRow {
  readonly step: SignupStepId;
  readonly label: string;
  readonly value: string;
  /** Kun "Mål" er fremhævet med orange værdi, som i designet. */
  readonly accent: boolean;
}

/** Kladden, som opsummeringen læser — allerede afledte værdier, ikke rå signaler. */
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
  /** Målvægten inden for skalaens grænser (designets `goalW`). */
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

/** `Tabe mig · 70 kg · moderat` – målvægten udelades ved "holde vægten". */
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

/** `3 × 45 min · moderat` – eller "Ingen faste træninger", når ingen dage er valgt. */
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
 * Designets `sumRows`: ni linjer i samme rækkefølge som flowet. Funktionen er ren, så den
 * kan testes uden at rejse komponenten.
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
