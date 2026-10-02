import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, fromEvent } from 'rxjs';
import {
  HEALTH_SOURCE_NAME_KEY,
  STEP_SYNC_MIN_DAYS,
  STEP_SYNC_TEXT_KEY,
  STEP_SYNC_WINDOW_DAYS,
} from '../../../../core/constants/step-sync';
import { StepSyncStatus } from '../../../../core/models/step-sync';
import { injectTranslate } from '../../../../core/services/language/translate';
import { StepSyncService } from '../../../../core/services/step-sync/step-sync';
import { toApiError } from '../../../../core/utils/api';
import { formatDayMonth, formatInteger } from '../../../../core/utils/date-format';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiConfirmSheet } from '../../../../shared/components/ui-confirm-sheet/ui-confirm-sheet';
import {
  FormErrorTone,
  UiFormError,
} from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiSwitch } from '../../../../shared/components/ui-switch/ui-switch';

const TEXT_KEY = {
  LABEL: 'profile.stepSync.label',
  HINT: 'profile.stepSync.hint',
  OPEN_SETTINGS: 'profile.stepSync.openSettings',
} as const;

interface StatusLine {
  readonly text: string;
  readonly tone: FormErrorTone;
}

/** The statuses with their own line; the others show the latest sync, if there is one. */
const STATUS_LINE: Partial<Record<StepSyncStatus, { key: string; tone: FormErrorTone }>> = {
  syncing: { key: STEP_SYNC_TEXT_KEY.SYNCING, tone: 'accent' },
  insufficient: { key: STEP_SYNC_TEXT_KEY.INSUFFICIENT, tone: 'accent' },
  'no-steps': { key: STEP_SYNC_TEXT_KEY.NO_STEPS, tone: 'negative' },
  'no-permission': { key: STEP_SYNC_TEXT_KEY.NO_PERMISSION, tone: 'negative' },
  failed: { key: STEP_SYNC_TEXT_KEY.FAILED, tone: 'negative' },
};
/** The switch waits while the store loads or syncs, and while it is unknown whether it is on. */
const BUSY_STATUSES: readonly StepSyncStatus[] = ['loading', 'syncing', 'error'];
/** The outcomes that allowing access outside the app (2.6-4a) can change. */
const ACCESS_STATUSES: readonly StepSyncStatus[] = ['no-permission', 'no-steps'];

/**
 * Spec 2.6 and 9.2-3a on Profile → Privatliv: "Skridt fra Apple Sundhed" (iOS) / "… Health
 * Connect" (Android) with a switch, a short explanation and the latest outcome. Only shown where
 * the device has the health store (`StepSyncService.available`), so never in the browser.
 *
 * On asks for access and syncs right away; off asks first (`app-ui-confirm-sheet`), because the
 * activity level then has to be updated by hand. Pessimistic: the switch shows the value being
 * saved and is locked meanwhile; a failure flips it back and says why below it.
 *
 * Under the status line: "Prøv igen" when the consent couldn't be read (the switch is locked,
 * since on or off is unknown), and "Giv adgang" when it is on but the health store denies reading
 * (2.6-4a) – iOS only lists an app under Sundhed → Dataadgang once it has asked, which a reinstall
 * or a new phone hasn't. On Android a denied request offers "Åbn Health Connect" instead: after
 * two denials Health Connect no longer shows its dialog. Access allowed there (or in iOS's
 * Settings) counts as soon as the app is visible again – the row loads the store once more.
 */
@Component({
  selector: 'app-profile-step-sync',
  imports: [TranslatePipe, UiButton, UiConfirmSheet, UiFormError, UiSwitch],
  templateUrl: './profile-step-sync.html',
  styleUrl: './profile-step-sync.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'profile-step-sync' },
})
export class ProfileStepSync {
  private readonly stepSync = inject(StepSyncService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly t = injectTranslate();

  protected readonly available = this.stepSync.available;
  /** The parameters the step sync's texts take. */
  private readonly params = computed(() => {
    const source = this.stepSync.source;
    return {
      source: source === null ? '' : this.t(HEALTH_SOURCE_NAME_KEY[source]),
      days: STEP_SYNC_WINDOW_DAYS,
      minDays: STEP_SYNC_MIN_DAYS,
    };
  });
  protected readonly label = computed(() => this.t(TEXT_KEY.LABEL, this.params()));
  protected readonly hint = computed(() => this.t(TEXT_KEY.HINT, this.params()));
  protected readonly offSheetParams = computed(() => ({ source: this.params().source }));
  protected readonly openSettingsLabel = computed(() =>
    this.t(TEXT_KEY.OPEN_SETTINGS, this.params()),
  );

  /** The value `enable()` / `disable()` is saving, else `null`. */
  private readonly saving = signal<boolean | null>(null);
  protected readonly confirmOpen = signal(false);
  protected readonly disabling = computed(() => this.saving() === false);
  /** Off while the confirmation is open, so "Annuller" flips it back on. */
  protected readonly checked = computed(
    () => !this.confirmOpen() && (this.saving() ?? this.stepSync.enabled()),
  );
  protected readonly busy = computed(
    () => this.saving() !== null || BUSY_STATUSES.includes(this.stepSync.status()),
  );
  protected readonly loadFailed = computed(() => this.stepSync.status() === 'error');
  protected readonly accessMissing = computed(
    () => this.stepSync.enabled() && this.stepSync.status() === 'no-permission',
  );
  private readonly errorKey = signal<string | null>(null);
  /** Android, after a denied request: Health Connect may no longer show its dialog. */
  protected readonly openSettingsShown = computed(
    () => this.stepSync.canOpenSettings && this.errorKey() === STEP_SYNC_TEXT_KEY.ACCESS_DENIED,
  );
  /** On, but the health store gives no steps – access may be allowed outside the app meanwhile. */
  private readonly awaitingAccess = computed(
    () =>
      this.stepSync.enabled() && ACCESS_STATUSES.includes(this.stepSync.status()) && !this.busy(),
  );
  protected readonly statusLine: Signal<StatusLine | null> = computed(() => {
    const errorKey = this.errorKey();
    if (errorKey !== null) {
      return { text: this.t(errorKey, this.params()), tone: 'negative' };
    }
    if (this.loadFailed()) {
      return { text: this.t(STEP_SYNC_TEXT_KEY.LOAD_FAILED), tone: 'negative' };
    }
    if (!this.stepSync.enabled()) {
      return null;
    }
    const line = STATUS_LINE[this.stepSync.status()];
    if (line !== undefined) {
      return { text: this.t(line.key, this.params()), tone: line.tone };
    }
    const last = this.stepSync.lastSync();
    return last === null
      ? null
      : {
          text: this.t(STEP_SYNC_TEXT_KEY.SYNCED, {
            day: formatDayMonth(this.t, new Date(last.syncedAt)),
            steps: formatInteger(last.dailySteps),
          }),
          tone: 'positive',
        };
  });

  constructor() {
    // Back from Health Connect or Settings: the store's status replaces the last attempt's error.
    fromEvent(this.document, 'visibilitychange')
      .pipe(
        filter(() => this.document.visibilityState === 'visible' && this.awaitingAccess()),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.errorKey.set(null);
        this.retryLoad();
      });
  }

  protected toggle(on: boolean): void {
    if (this.busy()) {
      return;
    }
    this.errorKey.set(null);
    if (!on) {
      this.confirmOpen.set(true);
      return;
    }
    this.saving.set(true);
    this.stepSync
      .enable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enabled) => {
          this.saving.set(null);
          if (!enabled) {
            this.errorKey.set(STEP_SYNC_TEXT_KEY.ACCESS_DENIED);
          }
        },
        error: (error: unknown) => {
          this.saving.set(null);
          this.errorKey.set(toApiError(error).messageKey);
        },
      });
  }

  /**
   * Reads the consent again (and syncs, when due). Not cancelled with the row: `load()` never
   * errors and completes, and cut off midway the store would stay `loading` – the switch locked.
   */
  protected retryLoad(): void {
    this.stepSync.load().subscribe();
  }

  /** Health Connect's settings; back in the app, the row shows the store's status again. */
  protected openSettings(): void {
    this.errorKey.set(null);
    void this.stepSync.openSettings();
  }

  protected cancelOff(): void {
    this.confirmOpen.set(false);
  }

  /** Spec 9.2-3a: withdraws the consent; the sheet stays busy until the API has answered. */
  protected confirmOff(): void {
    if (this.saving() !== null) {
      return;
    }
    this.saving.set(false);
    this.stepSync
      .disable()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.closeOff(null),
        error: (error: unknown) => this.closeOff(toApiError(error).messageKey),
      });
  }

  private closeOff(errorKey: string | null): void {
    this.saving.set(null);
    this.confirmOpen.set(false);
    this.errorKey.set(errorKey);
  }
}
