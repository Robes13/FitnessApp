import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { WEIGHT_LOG_HISTORY_RANGE } from '../../../core/constants/weight';
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
import { clamp, roundTo } from '../../../core/utils/math';
import { NOW } from '../../../core/utils/now';

/** The tone of a weight change: green when it goes the right way, red when it doesn't. */
export type WeightChangeTone = Extract<Tone, 'positive' | 'negative' | 'muted'>;

/** A row in "Recent weigh-ins". */
export interface WeighLogRow {
  readonly id: string;
  /** `'I dag'` · `'I går'` · `'3 dage siden'`. */
  readonly date: string;
  /** `'07:45'`. */
  readonly time: string;
  /** The weight with a Danish comma, e.g. `'75,0'`. */
  readonly kg: string;
  /** The raw weight – the edit sheet's starting value. */
  readonly kgValue: number;
  /** The difference from the previous weigh-in, or `'Start'` for the oldest one. */
  readonly delta: string;
  readonly deltaTone: WeightChangeTone;
  /** Ready-made BEM modifier for `delta`, so the template avoids building the class name. */
  readonly deltaClass: string;
}

/** A range chip below the chart. */
export interface WeightRangeOption {
  readonly id: WeightRange;
  readonly label: string;
}

/** The chip texts from the design's `ranges` – shorter than the chart's `rangeLabel`. */
export const WEIGHT_RANGE_OPTIONS: readonly WeightRangeOption[] = [
  { id: '1u', label: '1 uge' },
  { id: '4u', label: '4 uger' },
  { id: '3m', label: '3 mdr.' },
];

/** The design's default range. */
export const DEFAULT_WEIGHT_RANGE: WeightRange = '4u';
/** The step for −/+ and the ruler. */
export const WEIGHT_STEP_KG = 0.1;

const TENTHS_PER_KG = 10;
/** Below this difference the weight counts as unchanged (design's 0.05 kg). */
const NEUTRAL_DELTA_KG = 0.05;
/** "Maintain weight" is satisfied within ±0.5 kg. */
const MAINTAIN_TOLERANCE_KG = 0.5;
/** The design shows six weigh-ins in the list until the user expands it. */
export const COLLAPSED_LOG_ROWS = 6;

const EMPTY_LOG_MESSAGE = 'Ingen vejninger endnu.';
const NO_RECENT_LOG_MESSAGE = 'Ingen vejninger de sidste 3 mdr.';
/** Design's `good` for "maintain": the deviation from the goal with a small bonus. */
const MAINTAIN_PROGRESS_BONUS_KG = 0.3;

/**
 * The design's color logic for a weight change: "gain" rewards an increase, "maintain weight"
 * rewards a small movement, everything else rewards a decrease. Near-zero is neutral.
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
 * The weight screen's derived values: the draft weight the user adjusts, the difference from
 * the last weigh-in, the distance to the goal weight, the chart's points and the list of weigh-ins.
 *
 * The service is **feature-local** and provided by `WeightPage` (`providers: [WeightViewService]`),
 * so the draft and the selected range live exactly as long as the screen – just like in the
 * design, where `newWeight10` and `range` reset when leaving the tab. All persistent state
 * (weigh-ins and profile weight) lives in `WeightLogService` and `UserProfileService`.
 */
@Injectable()
export class WeightViewService {
  private readonly profile = inject(UserProfileService);
  private readonly log = inject(WeightLogService);
  private readonly now = inject(NOW);

  /** `null` = the user hasn't touched the draft yet; so it follows the profile's weight. */
  private readonly draftTenths = signal<number | null>(null);
  private readonly rangeState = signal<WeightRange>(DEFAULT_WEIGHT_RANGE);
  private readonly logExpandedState = signal(false);
  private readonly editingId = signal<string | null>(null);

  readonly range: Signal<WeightRange> = this.rangeState.asReadonly();
  readonly rangeOptions = WEIGHT_RANGE_OPTIONS;

  readonly profileWeightKg = computed(() => this.profile.profile().weightKg);
  readonly heightCm = computed(() => this.profile.profile().heightCm);
  readonly goal = computed(() => this.profile.profile().goal);

  /** The weight from the most recent weigh-in – design's `wlog[0].kg`. */
  readonly lastWeighedKg = computed(() => this.log.latest()?.kg ?? this.profileWeightKg());

  /** The draft weight the user is registering (design's `nw`). */
  readonly draftKg = computed(() => {
    const override = this.draftTenths();
    return override === null ? roundTo(this.profileWeightKg(), 1) : override / TENTHS_PER_KG;
  });

  readonly draftText = computed(() => formatDecimal(this.draftKg()));
  /** Above 100 kg the number takes up too much space at 64 px – the design switches to 52 px. */
  readonly draftIsWide = computed(() => this.draftKg() >= 100);

  /** Design's `gw`: "maintain weight" targets the current weight. */
  readonly goalWeightKg = computed(() => {
    const profile = this.profile.profile();
    return profile.goal === 'hold'
      ? this.profileWeightKg()
      : clamp(profile.goalWeightKg, WEIGHT_MIN_KG, WEIGHT_MAX_KG);
  });

  /** The draft minus the last weigh-in (design's `wDelta`). */
  readonly deltaKg = computed(() => this.draftKg() - this.lastWeighedKg());
  readonly deltaText = computed(() => formatSignedDecimal(this.deltaKg()));
  readonly deltaTone = computed(() => weightChangeTone(this.deltaKg(), this.goal()));

  readonly toGoalKg = computed(() => Math.abs(this.goalWeightKg() - this.draftKg()));
  readonly toGoalText = computed(() => formatDecimal(roundTo(this.toGoalKg(), 1)));

  /**
   * Design's `good`: how far the draft has moved in the right direction. Drives the figure's
   * mood, sweat, steam and headband color.
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

  /** The weigh-ins in the selected range, oldest first. Empty until the user has weighed in. */
  readonly seriesKg = computed<readonly number[]>(() =>
    this.log.seriesFor(this.rangeState()).map((point) => point.kg),
  );

  /** `'Sidste 4 uger'` – the heading on the right in the chart card. */
  readonly rangeLabel = computed(() => this.log.rangeLabel(this.rangeState()));
  /** `'-4 uger'` – the chart's left-hand footer. */
  readonly rangeStartLabel = computed(() => this.rangeLabel().replace('Sidste ', '-'));

  /** The difference between the chart's first and last point. */
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

  /** The profile's weight without a redundant `,0` – design's `weightText`. */
  readonly profileWeightText = computed(() => trimZeroDecimal(this.profileWeightKg()));
  readonly goalWeightText = computed(() => trimZeroDecimal(this.goalWeightKg()));

  /**
   * Every weigh-in from the last 3 months (`WEIGHT_LOG_HISTORY_RANGE`), newest first. Older
   * weigh-ins are never listed, but the oldest listed row is still compared with the weigh-in
   * before it, so "Start" only marks the user's very first weigh-in.
   */
  readonly allLogRows = computed<readonly WeighLogRow[]>(() => {
    const entries = this.log.entries();
    const goal = this.goal();
    return this.log.entriesWithin(WEIGHT_LOG_HISTORY_RANGE).map((entry, index) => {
      // `entriesWithin` is a newest-first prefix of `entries`, so the indexes line up.
      const previous = entries[index + 1];
      const change = previous ? entry.kg - previous.kg : 0;
      const at = new Date(entry.at);
      const deltaTone: WeightChangeTone = previous ? weightChangeTone(change, goal) : 'muted';
      return {
        id: entry.id,
        date: formatRelativeDay(at, this.now()),
        time: formatTime(at),
        kg: formatDecimal(entry.kg),
        kgValue: entry.kg,
        delta: previous ? formatSignedDecimal(change) : 'Start',
        deltaTone,
        deltaClass: `weight-log-list__delta--${deltaTone}`,
      };
    });
  });

  readonly logExpanded: Signal<boolean> = this.logExpandedState.asReadonly();

  /** The rows shown: the six newest, or all from the last 3 months when expanded. */
  readonly logRows = computed<readonly WeighLogRow[]>(() => {
    const rows = this.allLogRows();
    return this.logExpandedState() ? rows : rows.slice(0, COLLAPSED_LOG_ROWS);
  });

  /** How many rows "Vis alle" would add; 0 hides the toggle. */
  readonly hiddenLogCount = computed(() =>
    Math.max(0, this.allLogRows().length - COLLAPSED_LOG_ROWS),
  );

  /** Distinguishes "never weighed" from "nothing in the last 3 months". */
  readonly logEmptyMessage = computed(() =>
    this.hasEntries() ? NO_RECENT_LOG_MESSAGE : EMPTY_LOG_MESSAGE,
  );

  /** The weigh-in open in the edit sheet, or `null` when the sheet is closed. */
  readonly editingRow = computed<WeighLogRow | null>(() => {
    const id = this.editingId();
    return id === null ? null : (this.allLogRows().find((row) => row.id === id) ?? null);
  });

  /** Sets the draft in whole tenths and keeps it within 30–300 kg. */
  setDraftKg(kg: number): void {
    const clamped = clamp(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG);
    this.draftTenths.set(Math.round(clamped * TENTHS_PER_KG));
  }

  /** The −/+ buttons: one step of 0.1 kg. */
  adjustDraftKg(stepKg: number): void {
    this.setDraftKg(this.draftKg() + stepKg);
  }

  selectRange(range: WeightRange): void {
    this.rangeState.set(range);
  }

  toggleLogExpanded(): void {
    this.logExpandedState.update((expanded) => !expanded);
  }

  startEdit(id: string): void {
    this.editingId.set(id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  /** Saves the corrected weight. `WeightLogService` keeps the profile's weight in sync. */
  saveEdit(kg: number): void {
    const id = this.editingId();
    if (id !== null) {
      this.log.update(id, clamp(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG));
    }
    this.editingId.set(null);
  }

  /** Deletes the weigh-in open in the edit sheet. */
  removeEditing(): void {
    const id = this.editingId();
    if (id !== null) {
      this.log.remove(id);
    }
    this.editingId.set(null);
  }

  /**
   * Saves the draft as a weigh-in. A second weigh-in the same day replaces today's entry
   * (`WeightLogService.add`), which also updates the profile's weight.
   */
  save(): WeighEntry {
    return this.log.add(this.draftKg());
  }
}

/**
 * The chart's delta is colored like a weight change, but "maintain weight" is satisfied as long
 * as the curve stays within ±0.5 kg – even when the movement is zero (design's `deltaColor`).
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

/** `75` → `'75'`, `74,5` → `'74,5'` (design's `weightText`). */
function trimZeroDecimal(kg: number): string {
  const text = formatDecimal(kg);
  return text.endsWith(',0') ? text.slice(0, -2) : text;
}
