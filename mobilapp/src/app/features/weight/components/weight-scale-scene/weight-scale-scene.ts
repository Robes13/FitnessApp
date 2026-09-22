import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { formatDecimal } from '../../../../core/utils/date-format';
import {
  FigureBody,
  FigureExpression,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../shared/components/figure';
import {
  PUPIL_LOOK_X,
  PUPIL_LOOK_Y,
  SAVE_JUMP_Y,
  SAVE_SPARKS,
  SCENE_HEIGHT_PX,
  SCENE_WIDTH_PX,
  STEAM_DURATION_SECONDS,
  puddleSize,
  sceneBandTone,
  sceneMood,
  steamPath,
  steamPuffs,
  sweatDrops,
  sweatPath,
} from './scale-scene-geometry';

/**
 * Badevægten med figuren ovenpå. Vægtens display viser kladden, og figuren reagerer på
 * fremgangen: humør, pandebåndets farve, sved, vandpyt og damp. Når vejningen gemmes,
 * hopper figuren og fem gnister blinker.
 *
 * Kroppen er `FigureBody` fra `shared/` – scenen tegner kun badevægten og partiklerne
 * omkring den.
 */
@Component({
  selector: 'app-weight-scale-scene',
  imports: [FigureBody],
  templateUrl: './weight-scale-scene.html',
  styleUrl: './weight-scale-scene.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'weight-scale-scene',
    '[style.--weight-scale-scene-width.px]': 'sceneWidth',
    '[style.--weight-scale-scene-height.px]': 'sceneHeight',
  },
})
export class WeightScaleScene {
  /** Kladdevægten, figuren står med. */
  readonly weightKg = input.required<number>();
  readonly heightCm = input.required<number>();
  /** Designets `good`: kilo i den rigtige retning. Styrer humør, sved, damp og bånd. */
  readonly progressKg = input.required<number>();
  /** Lige efter "Gem vejning": figuren hopper, og gnisterne blinker. */
  readonly saved = input(false, { transform: booleanAttribute });
  /** −1, 0 eller 1 – pupillerne følger den retning, vægten netop blev ændret i. */
  readonly lookDirection = input(0);

  /** Scenens tegneflade – bindes som lokale variabler, fordi det er SVG'ens egen geometri. */
  protected readonly sceneWidth = SCENE_WIDTH_PX;
  protected readonly sceneHeight = SCENE_HEIGHT_PX;
  protected readonly sparks = SAVE_SPARKS;
  protected readonly steamDurationSeconds = STEAM_DURATION_SECONDS;
  protected readonly sweatPath = sweatPath;
  protected readonly steamPath = steamPath;

  protected readonly geometry = animatedFigure(() =>
    computeFigureGeometry(this.weightKg(), this.heightCm(), sceneMood(this.progressKg())),
  );
  protected readonly bandTone = computed(() => sceneBandTone(this.progressKg()));
  protected readonly scaleText = computed(() => formatDecimal(this.weightKg()));

  protected readonly expression = computed<Partial<FigureExpression>>(() => {
    const direction = this.lookDirection();
    return {
      pupilOffsetX: Math.sign(direction) * PUPIL_LOOK_X,
      pupilOffsetY: direction === 0 ? 0 : PUPIL_LOOK_Y,
    };
  });

  protected readonly figureTransform = computed(
    () => `translate(0 ${this.saved() ? SAVE_JUMP_Y : 0})`,
  );

  protected readonly puddle = computed(() => puddleSize(this.progressKg()));
  protected readonly sweat = computed(() =>
    sweatDrops(this.progressKg(), this.geometry().headY, this.geometry().bodyY),
  );
  protected readonly steam = computed(() => steamPuffs(this.progressKg(), this.geometry().headY));
}
