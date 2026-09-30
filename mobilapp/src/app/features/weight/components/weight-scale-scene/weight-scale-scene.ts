import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
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
 * The bathroom scale with the figure on top. The scale's display shows the draft, and the figure
 * reacts to the progress: mood, headband color, sweat, puddle and steam. When the weigh-in is
 * saved, the figure jumps and five sparks flash.
 *
 * The body is `FigureBody` from `shared/` – the scene only draws the scale and the particles
 * around it.
 */
@Component({
  selector: 'app-weight-scale-scene',
  imports: [FigureBody, TranslatePipe],
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
  /** The draft weight the figure is standing with. */
  readonly weightKg = input.required<number>();
  readonly heightCm = input.required<number>();
  /** Design's `good`: kilos in the right direction. Drives mood, sweat, steam and band. */
  readonly progressKg = input.required<number>();
  /** Right after "Save weigh-in": the figure jumps and the sparks flash. */
  readonly saved = input(false, { transform: booleanAttribute });
  /** −1, 0 or 1 – the pupils follow the direction the weight was just changed in. */
  readonly lookDirection = input(0);

  /** The scene's canvas – bound as local variables, since it's the SVG's own geometry. */
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
