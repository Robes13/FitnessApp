import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { injectTranslate } from '../../../../../core/services/language/translate';
import {
  FigureBody,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../../shared/components/figure';
import {
  SegmentOption,
  UiSegmentedControl,
} from '../../../../../shared/components/ui-segmented-control/ui-segmented-control';
import { SignupStateService } from '../../../services/signup-state';
import { bandToneForGender } from '../../../../../shared/components/figure';

const CAPTION_YES_KEY = 'signup.notificationsStep.captionYes';
const CAPTION_NO_KEY = 'signup.notificationsStep.captionNo';
const CAPTION_UNANSWERED_KEY = 'signup.notificationsStep.captionUnanswered';

const CHOICES: readonly { readonly value: boolean; readonly labelKey: string }[] = [
  { value: true, labelKey: 'signup.notificationsStep.yes' },
  { value: false, labelKey: 'signup.notificationsStep.no' },
];

/** The design's fixed dimensions from the screen (HTML line 905–930), bound as CSS variables. */
const NOTIFICATIONS_LAYOUT = { captionWidth: 300, captionHeight: 40, sceneHeight: 270 } as const;

/** The bell's x-axis in the figure's viewBox – constants from the design. */
const BELL_X = 140;
const BELL_ORIGIN_X = 158;
/** The bell's offsets up from the center of the head (the design's `headY - n`). */
const BELL_OFFSETS = { translate: 62, origin: 60, wave1: 48, wave2: 56, sleep: 40 } as const;

/**
 * The bell's placement, derived from the head's y-position, exactly like the
 * design's `bellY` / `bellTopY` / `bellWaveY1` / `bellWaveY2` / `zzzY`.
 */
interface BellGeometry {
  readonly translateY: number;
  readonly originY: number;
  readonly waveY1: number;
  readonly waveY2: number;
  readonly sleepY: number;
}

/**
 * Step `notifications` (the design's `sNotif`): may we send reminders?
 *
 * The scene responds to the choice: on "Yes please" an orange bell rings with sound
 * waves, on "No thanks" it's gray and crossed out, the figure closes its eyes, and
 * "z z z" is shown. The choice is `null` until the user answers — at that point the
 * knob in the pill is invisible, and `SignupStateService.canContinue` is false.
 */
@Component({
  selector: 'app-notifications-step',
  imports: [FigureBody, TranslatePipe, UiSegmentedControl],
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
  private readonly t = injectTranslate();

  protected readonly state = inject(SignupStateService);
  protected readonly layout = NOTIFICATIONS_LAYOUT;
  protected readonly choices = computed<readonly SegmentOption<boolean>[]>(() =>
    CHOICES.map(({ value, labelKey }) => ({ value, label: this.t(labelKey) })),
  );

  protected readonly caption = computed(() => {
    switch (this.state.notifications()) {
      case true:
        return this.t(CAPTION_YES_KEY);
      case false:
        return this.t(CAPTION_NO_KEY);
      default:
        return this.t(CAPTION_UNANSWERED_KEY);
    }
  });

  protected readonly geometry = animatedFigure(() =>
    computeFigureGeometry(this.state.weightKg(), this.state.heightCm()),
  );
  protected readonly bandTone = computed(() => bandToneForGender(this.state.gender()));
  protected readonly asleep = computed(() => this.state.notifications() === false);
  protected readonly ringing = computed(() => this.state.notifications() === true);
  protected readonly expression = computed(() => ({ eyesClosed: this.asleep() }));

  /** The scene's three in/out fades – the design's visibility per choice, kept out of the template. */
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
  /** `transform-box: view-box`, so the origin is in the figure's viewBox units. */
  protected readonly bellOrigin = computed(() => `${BELL_ORIGIN_X}px ${this.bell().originY}px`);
  protected readonly wavePath1 = computed(() => `M184 ${this.bell().waveY1} q 6 8 0 16`);
  protected readonly wavePath2 = computed(() => `M192 ${this.bell().waveY2} q 8 12 0 24`);

  protected onChoice(value: boolean | null): void {
    this.state.notifications.set(value);
  }
}
