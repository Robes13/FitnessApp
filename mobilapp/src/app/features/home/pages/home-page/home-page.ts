import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session/session';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { HomeCelebrationToast } from '../../components/home-celebration-toast/home-celebration-toast';
import { HomeDayCard } from '../../components/home-day-card/home-day-card';
import { HomeGoalCard } from '../../components/home-goal-card/home-goal-card';
import { HomeMonthSheet } from '../../components/home-month-sheet/home-month-sheet';
import { HomeTodoCard } from '../../components/home-todo-card/home-todo-card';
import { HomeWeekCard } from '../../components/home-week-card/home-week-card';
import { HomeWeekRings } from '../../components/home-week-rings/home-week-rings';
import { VerifyEmailSheet } from '../../components/verify-email-sheet/verify-email-sheet';
import { HomeSummaryService } from '../../services/home-summary';

/** The toast stays on screen for 3.4 s, matching the design. */
const CELEBRATION_DURATION_MS = 3400;
/** The design's haptic pattern for when the daily goal is hit. */
const CELEBRATION_VIBRATION_MS: readonly number[] = [16, 45, 28];

/**
 * Home: greeting and avatar, the last seven days' rings (with "Prøv igen" when a store failed to
 * load, and the 30-day sheet below), next step, the selected day's card, the goal card, and the
 * week's key figures.
 *
 * The page owns the celebration toast: when today's calories cross the goal, it pops up
 * (with vibration where the device supports it), and the timer is cleared when the page is
 * left. If the goal is already met when the data has loaded, there's no celebration – only the
 * transition counts, as in the design.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    TranslatePipe,
    ProfileAvatar,
    UiButton,
    UiFormError,
    HomeCelebrationToast,
    HomeDayCard,
    HomeGoalCard,
    HomeMonthSheet,
    HomeTodoCard,
    HomeWeekCard,
    HomeWeekRings,
    VerifyEmailSheet,
  ],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-page' },
})
export class HomePage {
  protected readonly summary = inject(HomeSummaryService);
  private readonly session = inject(SessionService);

  protected readonly profilePath = APP_PATH.PROFILE;
  /** Home stays locked behind the verification sheet until the session has tokens. */
  protected readonly isAuthenticated = this.session.isAuthenticated;
  protected readonly celebrating = signal(false);
  protected readonly monthSheetOpen = signal(false);

  /**
   * `null` until food log and profile have loaded: the first ready value is the baseline, so a
   * goal already reached isn't celebrated on every app start (the data arrives asynchronously).
   */
  private lastGoalReached: boolean | null = null;
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (!this.summary.ready()) {
        return;
      }
      const reached = this.summary.goalReached();
      const previous = this.lastGoalReached;
      this.lastGoalReached = reached;
      if (previous !== false || !reached) {
        return;
      }
      this.celebrate();
    });

    inject(DestroyRef).onDestroy(() => this.clearCelebrationTimer());
  }

  protected dismissCelebration(): void {
    this.clearCelebrationTimer();
    this.celebrating.set(false);
  }

  private celebrate(): void {
    this.vibrate();
    this.celebrating.set(true);
    this.clearCelebrationTimer();
    this.celebrationTimer = setTimeout(() => this.celebrating.set(false), CELEBRATION_DURATION_MS);
  }

  private clearCelebrationTimer(): void {
    if (this.celebrationTimer !== null) {
      clearTimeout(this.celebrationTimer);
      this.celebrationTimer = null;
    }
  }

  private vibrate(): void {
    try {
      navigator.vibrate?.([...CELEBRATION_VIBRATION_MS]);
    } catch {
      // Vibration isn't available on every device; the celebration should still work without it.
    }
  }
}
