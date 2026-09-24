import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { APP_PATH } from '../../../../core/constants/app-route';
import { SessionService } from '../../../../core/services/session/session';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import { HomeCelebrationToast } from '../../components/home-celebration-toast/home-celebration-toast';
import { HomeDayCard } from '../../components/home-day-card/home-day-card';
import { HomeGoalCard } from '../../components/home-goal-card/home-goal-card';
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
 * Home: greeting and avatar, the week's day rings, next step, the selected day's card,
 * the goal card, and the week's key figures.
 *
 * The page owns the celebration toast: when today's calories cross the goal, it pops up
 * (with vibration where the device supports it), and the timer is cleared when the page is
 * left. If the goal is already met before the page opens, there's no celebration – only the
 * transition counts, as in the design.
 */
@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    ProfileAvatar,
    HomeCelebrationToast,
    HomeDayCard,
    HomeGoalCard,
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
  protected readonly isEmailVerified = this.session.isEmailVerified;
  protected readonly celebrating = signal(false);

  /** `null` until the first run, so an already-reached ring isn't celebrated on open. */
  private lastGoalReached: boolean | null = null;
  private celebrationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
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
