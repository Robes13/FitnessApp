import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { GoalId } from '../../../core/models/profile';
import { Tone } from '../../../core/models/tone';
import { WeighEntry, WeightRange } from '../../../core/models/weight';
import { UserProfileService } from '../../../core/services/user-profile';
import { WeightLogService } from '../../../core/services/weight-log';
import {
  formatDecimal,
  formatRelativeDay,
  formatSignedDecimal,
  formatTime,
} from '../../../core/utils/date-format';
import { NOW } from '../../../core/utils/now';

/** Tonen på et vægtskifte: grøn når det går den rigtige vej, rød når det ikke gør. */
export type WeightChangeTone = Extract<Tone, 'positive' | 'negative' | 'muted'>;

/** En række i "Seneste vejninger". */
export interface WeighLogRow {
  readonly id: string;
  /** `'I dag'` · `'I går'` · `'3 dage siden'`. */
  readonly date: string;
  /** `'07:45'`. */
  readonly time: string;
  /** Vægten med dansk komma, fx `'75,0'`. */
  readonly kg: string;
  /** Forskellen til vejningen før, eller `'Start'` for den ældste. */
  readonly delta: string;
  readonly deltaTone: WeightChangeTone;
  /** Færdig BEM-modifier til `delta`, så templaten slipper for at bygge klassenavnet. */
  readonly deltaClass: string;
}

/** Et interval-chip under grafen. */
export interface WeightRangeOption {
  readonly id: WeightRange;
  readonly label: string;
}

/** Chip-teksterne fra designets `ranges` – kortere end grafens `rangeLabel`. */
export const WEIGHT_RANGE_OPTIONS: readonly WeightRangeOption[] = [
  { id: '1u', label: '1 uge' },
  { id: '4u', label: '4 uger' },
  { id: '3m', label: '3 mdr.' },
];

/** Designets standardinterval. */
export const DEFAULT_WEIGHT_RANGE: WeightRange = '4u';
/** Trinnet på −/+ og linealen. */
export const WEIGHT_STEP_KG = 0.1;

const TENTHS_PER_KG = 10;
/** Under denne forskel regnes vægten som uændret (designets 0,05 kg). */
const NEUTRAL_DELTA_KG = 0.05;
/** "Holde vægten" er tilfreds inden for ±0,5 kg. */
const MAINTAIN_TOLERANCE_KG = 0.5;
/** Designet viser højst seks vejninger i listen. */
const MAX_LOG_ROWS = 6;
/** Designets `good` for "hold": afvigelsen fra målet med en lille bonus. */
const MAINTAIN_PROGRESS_BONUS_KG = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundToTenths(kg: number): number {
  return Math.round(kg * TENTHS_PER_KG) / TENTHS_PER_KG;
}

/**
 * Designets farvelogik for et vægtskifte: "tage på" belønner en stigning, "holde vægten"
 * belønner en lille bevægelse, alt andet belønner et fald. Næsten-nul er neutralt.
 */
export function weightChangeTone(deltaKg: number, goal: GoalId | null): WeightChangeTone {
  if (Math.abs(deltaKg) < NEUTRAL_DELTA_KG) {
    return 'muted';
  }
  const good =
    goal === 'tage'
      ? deltaKg > 0
      : goal === 'hold'
        ? Math.abs(deltaKg) < MAINTAIN_TOLERANCE_KG
        : deltaKg < 0;
  return good ? 'positive' : 'negative';
}

/**
 * Vægt-skærmens afledte værdier: kladdevægten brugeren skruer på, forskellen til sidste
 * vejning, afstanden til målvægten, grafens punkter og listen over vejninger.
 *
 * Servicen er **feature-lokal** og udstilles af `WeightPage` (`providers: [WeightViewService]`),
 * så kladden og det valgte interval lever lige så længe som skærmen – præcis som i designet,
 * hvor `newWeight10` og `range` nulstilles, når man forlader fanen. Al vedvarende tilstand
 * (vejninger og profilvægt) ligger i `WeightLogService` og `UserProfileService`.
 */
@Injectable()
export class WeightViewService {
  private readonly profile = inject(UserProfileService);
  private readonly log = inject(WeightLogService);
  private readonly now = inject(NOW);

  /** `null` = brugeren har ikke rørt kladden endnu; så følger den profilens vægt. */
  private readonly draftTenths = signal<number | null>(null);
  private readonly rangeState = signal<WeightRange>(DEFAULT_WEIGHT_RANGE);

  readonly range: Signal<WeightRange> = this.rangeState.asReadonly();
  readonly rangeOptions = WEIGHT_RANGE_OPTIONS;

  readonly profileWeightKg = computed(() => this.profile.profile().weightKg);
  readonly heightCm = computed(() => this.profile.profile().heightCm);
  readonly goal = computed(() => this.profile.profile().goal);

  /** Vægten fra den seneste vejning – designets `wlog[0].kg`. */
  readonly lastWeighedKg = computed(() => this.log.latest()?.kg ?? this.profileWeightKg());

  /** Kladdevægten, brugeren er ved at registrere (designets `nw`). */
  readonly draftKg = computed(() => {
    const override = this.draftTenths();
    return override === null ? roundToTenths(this.profileWeightKg()) : override / TENTHS_PER_KG;
  });

  readonly draftText = computed(() => formatDecimal(this.draftKg()));
  /** Over 100 kg fylder tallet for meget i 64 px – designet skifter til 52 px. */
  readonly draftIsWide = computed(() => this.draftKg() >= 100);

  /** Designets `gw`: "holde vægten" sigter mod den nuværende vægt. */
  readonly goalWeightKg = computed(() => {
    const profile = this.profile.profile();
    return profile.goal === 'hold'
      ? this.profileWeightKg()
      : clamp(profile.goalWeightKg, WEIGHT_MIN_KG, WEIGHT_MAX_KG);
  });

  /** Kladden minus sidste vejning (designets `wDelta`). */
  readonly deltaKg = computed(() => this.draftKg() - this.lastWeighedKg());
  readonly deltaText = computed(() => formatSignedDecimal(this.deltaKg()));
  readonly deltaTone = computed(() => weightChangeTone(this.deltaKg(), this.goal()));

  readonly toGoalKg = computed(() => Math.abs(this.goalWeightKg() - this.draftKg()));
  readonly toGoalText = computed(() => formatDecimal(roundToTenths(this.toGoalKg())));

  /**
   * Designets `good`: hvor langt kladden er kommet i den rigtige retning. Styrer figurens
   * humør, sved, damp og pandebåndets farve.
   */
  readonly progressKg = computed(() => {
    const delta = this.deltaKg();
    const goal = this.goal();
    if (goal === 'tage') {
      return delta;
    }
    if (goal === 'hold') {
      return MAINTAIN_PROGRESS_BONUS_KG - Math.abs(delta);
    }
    return -delta;
  });

  readonly hasEntries = computed(() => this.log.entries().length > 0);

  readonly lastWeighLabel = computed(() => {
    const latest = this.log.latest();
    if (latest === null) {
      return 'Ingen vejninger endnu';
    }
    return `Sidst vejet ${formatRelativeDay(new Date(latest.at), this.now()).toLowerCase()}`;
  });

  /** Grafens 12 syntetiske punkter for det valgte interval. */
  readonly seriesKg = computed<readonly number[]>(() =>
    this.log
      .seriesFor(this.rangeState(), this.goal(), this.profileWeightKg())
      .map((point) => point.kg),
  );

  /** `'Sidste 4 uger'` – overskriften til højre i grafkortet. */
  readonly rangeLabel = computed(() => this.log.rangeLabel(this.rangeState()));
  /** `'-4 uger'` – grafens venstre fodnote. */
  readonly rangeStartLabel = computed(() => this.rangeLabel().replace('Sidste ', '-'));

  /** Forskellen mellem grafens første og sidste punkt. */
  readonly rangeDeltaKg = computed(() => {
    const series = this.seriesKg();
    const first = series[0];
    const last = series[series.length - 1];
    if (first === undefined || last === undefined || series.length < 2) {
      return 0;
    }
    return last - first;
  });
  readonly rangeDeltaText = computed(() => `${formatSignedDecimal(this.rangeDeltaKg())} kg`);
  readonly rangeDeltaTone = computed(() => rangeTone(this.rangeDeltaKg(), this.goal()));

  /** Profilens vægt uden et overflødigt `,0` – designets `weightText`. */
  readonly profileWeightText = computed(() => trimZeroDecimal(this.profileWeightKg()));
  readonly goalWeightText = computed(() => trimZeroDecimal(this.goalWeightKg()));

  readonly logRows = computed<readonly WeighLogRow[]>(() => {
    const entries = this.log.entries();
    const goal = this.goal();
    return entries.slice(0, MAX_LOG_ROWS).map((entry, index) => {
      const previous = entries[index + 1];
      const change = previous ? entry.kg - previous.kg : 0;
      const at = new Date(entry.at);
      const deltaTone: WeightChangeTone = previous ? weightChangeTone(change, goal) : 'muted';
      return {
        id: entry.id,
        date: formatRelativeDay(at, this.now()),
        time: formatTime(at),
        kg: formatDecimal(entry.kg),
        delta: previous ? formatSignedDecimal(change) : 'Start',
        deltaTone,
        deltaClass: `weight-log-list__delta--${deltaTone}`,
      };
    });
  });

  /** Sætter kladden i hele tiendedele og holder den inden for 30–300 kg. */
  setDraftKg(kg: number): void {
    const clamped = clamp(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG);
    this.draftTenths.set(Math.round(clamped * TENTHS_PER_KG));
  }

  /** −/+ knapperne: ét trin på 0,1 kg. */
  adjustDraftKg(stepKg: number): void {
    this.setDraftKg(this.draftKg() + stepKg);
  }

  selectRange(range: WeightRange): void {
    this.rangeState.set(range);
  }

  /** Gemmer kladden som en vejning. `WeightLogService` opdaterer også profilens vægt. */
  save(): WeighEntry {
    return this.log.add(this.draftKg());
  }
}

/**
 * Grafens delta farves som et vægtskifte, men "holde vægten" er tilfreds, så længe kurven
 * holder sig inden for ±0,5 kg – også når bevægelsen er nul (designets `deltaColor`).
 */
function rangeTone(deltaKg: number, goal: GoalId | null): WeightChangeTone {
  const good =
    goal === 'tage'
      ? deltaKg > 0
      : goal === 'hold'
        ? Math.abs(deltaKg) < MAINTAIN_TOLERANCE_KG
        : deltaKg < 0;
  return good ? 'positive' : 'negative';
}

/** `75` → `'75'`, `74,5` → `'74,5'` (designets `weightText`). */
function trimZeroDecimal(kg: number): string {
  const text = formatDecimal(kg);
  return text.endsWith(',0') ? text.slice(0, -2) : text;
}
