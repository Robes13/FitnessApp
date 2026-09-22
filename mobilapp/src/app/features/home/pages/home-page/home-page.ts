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
import { SessionService } from '../../../../core/services/session';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import { HomeCelebrationToast } from '../../components/home-celebration-toast/home-celebration-toast';
import { HomeDayCard } from '../../components/home-day-card/home-day-card';
import { HomeGoalCard } from '../../components/home-goal-card/home-goal-card';
import { HomeTodoCard } from '../../components/home-todo-card/home-todo-card';
import { HomeWeekCard } from '../../components/home-week-card/home-week-card';
import { HomeWeekRings } from '../../components/home-week-rings/home-week-rings';
import { VerifyEmailSheet } from '../../components/verify-email-sheet/verify-email-sheet';
import { HomeSummaryService } from '../../services/home-summary';

/** Toasten er på skærmen i 3,4 s som i designet. */
const CELEBRATION_DURATION_MS = 3400;
/** Designets haptik, når dagsmålet rammes. */
const CELEBRATION_VIBRATION_MS: readonly number[] = [16, 45, 28];

/**
 * Hjem: hilsen og avatar, ugens dagsringe, næste skridt, den valgte dags kort, målkortet
 * og ugens nøgletal.
 *
 * Siden ejer fejrings-toasten: når dagens kalorier krydser målet, poppes den frem (med
 * vibration, hvor enheden kan), og timeren ryddes, når siden forlades. Rammes målet allerede,
 * inden siden åbnes, fejres der ikke – det er først overgangen, der tæller, som i designet.
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

  /** `null` indtil første kørsel, så en allerede nået ring ikke fejres ved åbning. */
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
      // Vibration findes ikke på alle enheder; fejringen skal virke uden.
    }
  }
}
