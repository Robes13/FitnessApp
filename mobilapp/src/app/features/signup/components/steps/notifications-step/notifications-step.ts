import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { FigureBody, computeFigureGeometry } from '../../../../../shared/components/figure';
import {
  SegmentOption,
  UiSegmentedControl,
} from '../../../../../shared/components/ui-segmented-control/ui-segmented-control';
import { SignupStateService } from '../../../services/signup-state';
import { bandToneForGender } from '../../../../../shared/components/figure';

const CAPTION_YES =
  'Vi minder dig om vejning om morgenen, måltider i løbet af dagen og din ugestatus.';
const CAPTION_NO = 'Ingen påmindelser. Du finder alt i appen, når du selv åbner den.';
const CAPTION_UNANSWERED = 'Vælg om vi må sende dig påmindelser – du kan altid skifte i Profil.';

const CHOICES: readonly SegmentOption<boolean>[] = [
  { value: true, label: 'Ja tak' },
  { value: false, label: 'Nej tak' },
];

/** Designets faste mål fra skærmen (HTML-linje 905–930), bundet som CSS-variabler. */
const NOTIFICATIONS_LAYOUT = { captionWidth: 300, captionHeight: 40, sceneHeight: 270 } as const;

/** Klokkens x-akse i figurens viewBox – konstanter fra designet. */
const BELL_X = 140;
const BELL_ORIGIN_X = 158;
/** Klokkens afstande op fra hovedets midte (designets `headY - n`). */
const BELL_OFFSETS = { translate: 62, origin: 60, wave1: 48, wave2: 56, sleep: 40 } as const;

/**
 * Klokkens placering, afledt af hovedets y-position, præcis som designets
 * `bellY` / `bellTopY` / `bellWaveY1` / `bellWaveY2` / `zzzY`.
 */
interface BellGeometry {
  readonly translateY: number;
  readonly originY: number;
  readonly waveY1: number;
  readonly waveY2: number;
  readonly sleepY: number;
}

/**
 * Trin `notifications` (designets `sNotif`): må vi sende påmindelser?
 *
 * Scenen svarer på valget: ved "Ja tak" ringer en orange klokke med lydbølger, ved
 * "Nej tak" er den grå og overstreget, figuren lukker øjnene, og der står "z z z".
 * Valget er `null`, indtil brugeren svarer — så er knoppen i pillen usynlig, og
 * `SignupStateService.canContinue` er falsk.
 */
@Component({
  selector: 'app-notifications-step',
  imports: [FigureBody, UiSegmentedControl],
  templateUrl: './notifications-step.html',
  styleUrl: './notifications-step.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'notifications-step',
    '[style.--notifications-caption-width.px]': 'layout.captionWidth',
    '[style.--notifications-caption-height.px]': 'layout.captionHeight',
    '[style.--notifications-scene-height.px]': 'layout.sceneHeight',
  },
})
export class NotificationsStep {
  protected readonly state = inject(SignupStateService);
  protected readonly layout = NOTIFICATIONS_LAYOUT;
  protected readonly choices = CHOICES;
  protected readonly bellX = BELL_X;

  protected readonly caption = computed(() => {
    switch (this.state.notifications()) {
      case true:
        return CAPTION_YES;
      case false:
        return CAPTION_NO;
      default:
        return CAPTION_UNANSWERED;
    }
  });

  protected readonly geometry = computed(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm()),
  );
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
  protected readonly asleep = computed(() => this.state.notifications() === false);
  protected readonly ringing = computed(() => this.state.notifications() === true);
  protected readonly expression = computed(() => ({ eyesClosed: this.asleep() }));

  /** Scenens tre ind/ud-toninger – designets synlighed pr. valg, holdt ude af templaten. */
  protected readonly bellSlashOpacity = computed(() => (this.asleep() ? 1 : 0));
  protected readonly waveOpacity = computed(() => (this.ringing() ? 1 : 0));
  protected readonly snoreOpacity = computed(() => (this.asleep() ? 1 : 0));

  protected readonly bell = computed<BellGeometry>(() => {
    const headY = this.geometry().headY;
    return {
      translateY: Math.round(headY - BELL_OFFSETS.translate),
      originY: Math.round(headY - BELL_OFFSETS.origin),
      waveY1: Math.round(headY - BELL_OFFSETS.wave1),
      waveY2: Math.round(headY - BELL_OFFSETS.wave2),
      sleepY: Math.round(headY - BELL_OFFSETS.sleep),
    };
  });

  protected readonly bellTransform = computed(
    () => `translate(${BELL_X} ${this.bell().translateY}) scale(1.6)`,
  );
  /** `transform-box: view-box`, så origo er i figurens viewBox-enheder. */
  protected readonly bellOrigin = computed(() => `${BELL_ORIGIN_X}px ${this.bell().originY}px`);
  protected readonly wavePath1 = computed(() => `M184 ${this.bell().waveY1} q 6 8 0 16`);
  protected readonly wavePath2 = computed(() => `M192 ${this.bell().waveY2} q 8 12 0 24`);

  protected onChoice(value: boolean | null): void {
    this.state.notifications.set(value);
  }
}
