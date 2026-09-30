import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, defer, finalize, map, merge, mergeMap, of } from 'rxjs';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../core/constants/nutrition';
import { WEIGHT_LOG_HISTORY_RANGE } from '../../../core/constants/weight';
import { StoreStatus } from '../../../core/models/api';
import { GoalId } from '../../../core/models/profile';
import { Tone } from '../../../core/models/tone';
import { WeightRange } from '../../../core/models/weight';
import { UserProfileService } from '../../../core/services/user-profile/user-profile';
import { WeightLogService } from '../../../core/services/weight-log/weight-log';
import { toApiError } from '../../../core/utils/api';
import {
  formatDecimal,
  formatRelativeDay,
  formatSignedDecimal,
  formatTime,
} from '../../../core/utils/date-format';
import { clamp, roundTo } from '../../../core/utils/math';
import { NOW } from '../../../core/utils/now';
import { injectTranslate } from '../../../core/services/language/translate';

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
  readonly labelKey: string;
}

/** The chip texts from the design's `ranges` – shorter than the chart's `rangeLabel`. */
export const WEIGHT_RANGE_OPTIONS: readonly WeightRangeOption[] = [
  { id: '1u', labelKey: 'weight.view.ranges.week' },
  { id: '3u', labelKey: 'weight.view.ranges.threeWeeks' },
  { id: '3m', labelKey: 'weight.view.ranges.threeMonths' },
];

/** The chart's left-hand footer per range – design's `rangeLabel` with `'Sidste '` swapped for `'-'`. */
const WEIGHT_RANGE_START_LABEL_KEY: Readonly<Record<WeightRange, string>> = {
  '1u': 'weight.view.rangeStart.week',
  '3u': 'weight.view.rangeStart.threeWeeks',
  '3m': 'weight.view.rangeStart.threeMonths',
};

/** The default range – the spec's 3 weeks instead of the design's 4 (plan-v2 P16). */
export const DEFAULT_WEIGHT_RANGE: WeightRange = '3u';
/** The step for −/+ and the ruler. */
export const WEIGHT_STEP_KG = 0.1;

const TENTHS_PER_KG = 10;
/** Below this difference the weight counts as unchanged (design's 0.05 kg). */
const NEUTRAL_DELTA_KG = 0.05;
/** "Maintain weight" is satisfied within ±0.5 kg. */
const MAINTAIN_TOLERANCE_KG = 0.5;
/** The design shows six weigh-ins in the list until the user expands it. */
export const COLLAPSED_LOG_ROWS = 6;

const EMPTY_LOG_MESSAGE_KEY = 'weight.view.emptyLog';
/** The page's save and the overwrite question fail with this text. */
const SAVE_ERROR_KEY = 'weight.page.saveError';
const NO_RECENT_LOG_MESSAGE_KEY = 'weight.view.noRecentLog';
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
 * the last weigh-in, the distance to the goal weight, the chart's points and the list of weigh-ins
 * – and the screen's API actions (save, overwrite, edit, delete, retry) with their busy and error
 * states.
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
  private readonly t = injectTranslate();

  /** `null` = the user hasn't touched the draft yet; so it follows the profile's weight. */
  private readonly draftTenths = signal<number | null>(null);
  private readonly rangeState = signal<WeightRange>(DEFAULT_WEIGHT_RANGE);
  private readonly logExpandedState = signal(false);
  private readonly editingId = signal<string | null>(null);
  private readonly overwriteIdState = signal<string | null>(null);
  private readonly savingState = signal(false);
  private readonly editBusyState = signal(false);
  /** Keys, so a shown error follows a language switch. */
  private readonly saveErrorKey = signal<string | null>(null);
  private readonly overwriteErrorKey = signal<string | null>(null);
  private readonly editErrorKey = signal<string | null>(null);

  readonly range: Signal<WeightRange> = this.rangeState.asReadonly();
  readonly rangeOptions = WEIGHT_RANGE_OPTIONS;

  /**
   * The first load of the two stores the screen needs. `'loading'` wins, so "Prøv igen" only
   * shows once nothing is running any more.
   */
  readonly loadStatus = computed<StoreStatus>(() => {
    const statuses = [this.log.status(), this.profile.status()];
    if (statuses.includes('loading')) {
      return 'loading';
    }
    return statuses.includes('error') ? 'error' : 'ready';
  });

  /** "Gem vejning" (and "Ja, overskriv") is running – the buttons show a spinner. */
  readonly saving: Signal<boolean> = this.savingState.asReadonly();
  readonly saveError = this.translated(this.saveErrorKey);
  /** Today's weigh-in the overwrite question is about; `null` = the sheet is closed. */
  readonly overwriteId: Signal<string | null> = this.overwriteIdState.asReadonly();
  readonly overwriteError = this.translated(this.overwriteErrorKey);
  /** The edit sheet's save or delete is running. */
  readonly editBusy: Signal<boolean> = this.editBusyState.asReadonly();
  readonly editError = this.translated(this.editErrorKey);

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

  /** Without weigh-ins the profile's weight is the starting weight from sign-up (spec 6.1). */
  readonly lastWeighLabel = computed(() => {
    const latest = this.log.latest();
    if (latest === null) {
      return this.t('weight.view.neverWeighed');
    }
    const day = formatRelativeDay(this.t, new Date(latest.at), this.now()).toLowerCase();
    return this.t('weight.view.lastWeighed', { day });
  });

  /** The weigh-ins in the selected range, oldest first. Empty until the user has weighed in. */
  readonly seriesKg = computed<readonly number[]>(() =>
    this.log.seriesFor(this.rangeState()).map((point) => point.kg),
  );

  /** `'Sidste 3 uger'` – the heading on the right in the chart card. */
  readonly rangeLabel = computed(() => this.log.rangeLabel(this.rangeState()));
  /** `'-3 uger'` – the chart's left-hand footer. */
  readonly rangeStartLabel = computed(() =>
    this.t(WEIGHT_RANGE_START_LABEL_KEY[this.rangeState()]),
  );

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
  readonly rangeDeltaText = computed(() =>
    this.t('weight.view.rangeDelta', { delta: formatSignedDecimal(this.rangeDeltaKg()) }),
  );
  /** Neutral until the range holds two weigh-ins – a lone point has no change to judge. */
  readonly rangeDeltaTone = computed<WeightChangeTone>(() =>
    this.seriesKg().length < 2 ? 'muted' : rangeTone(this.rangeDeltaKg(), this.goal()),
  );

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
        date: formatRelativeDay(this.t, at, this.now()),
        time: formatTime(at),
        kg: formatDecimal(entry.kg),
        kgValue: entry.kg,
        delta: previous ? formatSignedDecimal(change) : this.t('weight.view.logStart'),
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
    this.t(this.hasEntries() ? NO_RECENT_LOG_MESSAGE_KEY : EMPTY_LOG_MESSAGE_KEY),
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

  /** "Prøv igen": reloads the store(s) that failed. Never errors. */
  retryLoad(): Observable<void> {
    return merge(
      ...[this.log, this.profile]
        .filter((store) => store.status() === 'error')
        .map((store) => store.load()),
    );
  }

  startEdit(id: string): void {
    this.editErrorKey.set(null);
    this.editingId.set(id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editErrorKey.set(null);
  }

  /** Saves the corrected weight (time unchanged). On an error the sheet stays open and says why. */
  saveEdit(kg: number): Observable<void> {
    return this.editing((id) =>
      this.log.update(id, clamp(kg, WEIGHT_MIN_KG, WEIGHT_MAX_KG)).pipe(map(() => undefined)),
    );
  }

  /** Deletes the weigh-in open in the edit sheet. */
  removeEditing(): Observable<void> {
    return this.editing((id) => this.log.remove(id));
  }

  /**
   * Saves the draft as today's weigh-in and emits once it is saved. Has the day a weigh-in
   * already, nothing is saved: `overwriteId` opens the question, and the observable completes
   * without a value. A failure shows `saveError`.
   */
  save(): Observable<void> {
    return this.track(
      this.savingState,
      this.saveErrorKey,
      () => SAVE_ERROR_KEY,
      () =>
        this.log.add(this.draftKg()).pipe(
          mergeMap((result) => {
            if (result.kind === 'saved') {
              return of(undefined);
            }
            this.overwriteErrorKey.set(null);
            this.overwriteIdState.set(result.id);
            return EMPTY;
          }),
        ),
    );
  }

  /** "Ja, overskriv": today's weigh-in gets the draft and the time now. Emits once overwritten. */
  confirmOverwrite(): Observable<void> {
    return this.track(
      this.savingState,
      this.overwriteErrorKey,
      () => SAVE_ERROR_KEY,
      () => {
        const id = this.overwriteIdState();
        return id === null
          ? EMPTY
          : this.log
              .update(id, this.draftKg(), this.now())
              .pipe(map(() => this.overwriteIdState.set(null)));
      },
    );
  }

  /** "Annuller" (spec 6.0-4b): nothing is sent, today's weigh-in stays. */
  cancelOverwrite(): void {
    this.overwriteIdState.set(null);
    this.overwriteErrorKey.set(null);
  }

  /** Runs `mutation` on the weigh-in open in the edit sheet and closes the sheet when it is done. */
  private editing(mutation: (id: string) => Observable<void>): Observable<void> {
    return this.track(
      this.editBusyState,
      this.editErrorKey,
      (error) => toApiError(error).messageKey,
      () => {
        const id = this.editingId();
        return id === null ? EMPTY : mutation(id).pipe(map(() => this.editingId.set(null)));
      },
    );
  }

  /**
   * One mutation at a time: `busy` while it runs – a second tap does nothing. A failure sets
   * `errorKey` to `keyFor(error)` and completes without a value, so callers never handle errors.
   */
  private track(
    busy: WritableSignal<boolean>,
    errorKey: WritableSignal<string | null>,
    keyFor: (error: unknown) => string,
    mutation: () => Observable<void>,
  ): Observable<void> {
    return defer(() => {
      if (busy()) {
        return EMPTY;
      }
      busy.set(true);
      errorKey.set(null);
      return mutation().pipe(
        catchError((error: unknown) => {
          errorKey.set(keyFor(error));
          return EMPTY;
        }),
        finalize(() => busy.set(false)),
      );
    });
  }

  private translated(key: Signal<string | null>): Signal<string | null> {
    return computed(() => {
      const value = key();
      return value === null ? null : this.t(value);
    });
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
