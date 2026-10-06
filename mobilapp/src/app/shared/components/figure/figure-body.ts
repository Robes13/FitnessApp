import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { FigureGeometry } from './figure-geometry';

/** The headband's color – gender, progress and training intensity color it differently. */
export type FigureBandTone =
  'accent' | 'pink' | 'white' | 'positive' | 'negative' | 'muted' | 'accent-strong' | 'accent-deep';

/** The cheeks' color – gets redder at higher intensity. */
export type FigureCheekTone = 'accent' | 'accent-soft' | 'negative' | 'negative-strong';

/**
 * The facial expression. All fields have default values from the geometry (smile, open mouth
 * and brows follow the weight), so a scene only overrides what it wants to control.
 */
export interface FigureExpression {
  readonly smileOpacity: number;
  readonly mouthRx: number;
  readonly mouthRy: number;
  readonly tongueRx: number;
  readonly tongueRy: number;
  /** The left brow's rotation in degrees. */
  readonly browRotation: number;
  /** The right brow's rotation in degrees. */
  readonly browRotationRight: number;
  readonly browOpacity: number;
  readonly cheekTone: FigureCheekTone;
  readonly cheekRadius: number;
  /** The pupils' offset in SVG units (the figure "looks" sideways / down). */
  readonly pupilOffsetX: number;
  readonly pupilOffsetY: number;
  /** Closed eyes (two arcs) instead of eyes with pupils. */
  readonly eyesClosed: boolean;
}

const HEAD_CENTRE_X = 100;
const PUPIL_LEFT_X = 91;
const PUPIL_RIGHT_X = 111;
const BROW_LEFT_X = 88;
const BROW_RIGHT_X = 112;
const EYELID_LEFT_X = 84;
const EYELID_RIGHT_X = 104;
const DEFAULT_CHEEK_RADIUS = 3.5;

/** The default expression: the design's base figure, where mouth and brows are driven by the geometry. */
export function defaultFigureExpression(geometry: FigureGeometry): FigureExpression {
  return {
    smileOpacity: geometry.smileOp,
    mouthRx: geometry.mouthRx,
    mouthRy: geometry.mouthRy,
    tongueRx: geometry.tongueRx,
    tongueRy: geometry.tongueRy,
    browRotation: geometry.browRot,
    browRotationRight: geometry.browRotR,
    browOpacity: geometry.browOp,
    cheekTone: 'accent',
    cheekRadius: DEFAULT_CHEEK_RADIUS,
    pupilOffsetX: 0,
    pupilOffsetY: 0,
    eyesClosed: false,
  };
}

/**
 * The figure's body as an attribute component on an SVG `<g>`:
 *
 * ```html
 * <svg viewBox="0 0 200 300"><g app-figure-body [geometry]="geometry()" /></svg>
 * ```
 *
 * Draws shadow, legs, shoes, arms, body, belt, (dumbbell) and head in the design's order.
 * All colors are `--color-figure-*` tokens via classes; scenes turn off individual parts
 * (`showRightArm`, `showShadow`) and draw their own animated
 * variants on top. `expression` overrides the face's default expression field by field.
 */
@Component({
  selector: 'g[app-figure-body]',
  templateUrl: './figure-body.html',
  styleUrl: './figure-body.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'figure-body',
    '[class.figure-body--animated]': 'animated()',
  },
})
export class FigureBody {
  readonly geometry = input.required<FigureGeometry>();
  readonly bandTone = input<FigureBandTone>('accent');
  readonly showDumbbell = input(false, { transform: booleanAttribute });
  readonly showRightArm = input(true, { transform: booleanAttribute });
  readonly showShadow = input(true, { transform: booleanAttribute });
  /** Depth shading as in the training scenes: left leg/arm/shoe darker, right arm lighter. */
  readonly shaded = input(false, { transform: booleanAttribute });
  /** Color and opacity transitions; the scene drives the geometry with animatedFigure. */
  readonly animated = input(true, { transform: booleanAttribute });
  readonly expression = input<Partial<FigureExpression>>({});

  /** The full expression: default values from the geometry overridden by `expression`. */
  protected readonly resolvedExpression = computed<FigureExpression>(() => {
    const base = defaultFigureExpression(this.geometry());
    const override = this.expression();
    return {
      smileOpacity: override.smileOpacity ?? base.smileOpacity,
      mouthRx: override.mouthRx ?? base.mouthRx,
      mouthRy: override.mouthRy ?? base.mouthRy,
      tongueRx: override.tongueRx ?? base.tongueRx,
      tongueRy: override.tongueRy ?? base.tongueRy,
      browRotation: override.browRotation ?? base.browRotation,
      browRotationRight: override.browRotationRight ?? base.browRotationRight,
      browOpacity: override.browOpacity ?? base.browOpacity,
      cheekTone: override.cheekTone ?? base.cheekTone,
      cheekRadius: override.cheekRadius ?? base.cheekRadius,
      pupilOffsetX: override.pupilOffsetX ?? base.pupilOffsetX,
      pupilOffsetY: override.pupilOffsetY ?? base.pupilOffsetY,
      eyesClosed: override.eyesClosed ?? base.eyesClosed,
    };
  });

  protected readonly bandClass = computed(() => `figure-body__band--${this.bandTone()}`);
  protected readonly cheekClass = computed(
    () => `figure-body__cheek--${this.resolvedExpression().cheekTone}`,
  );

  protected readonly headTransform = computed(() => {
    const g = this.geometry();
    return `rotate(${g.headRot} ${HEAD_CENTRE_X} ${g.headY})`;
  });
  protected readonly browLeftTransform = computed(
    () =>
      `rotate(${this.resolvedExpression().browRotation} ${BROW_LEFT_X} ${this.geometry().browY})`,
  );
  protected readonly browRightTransform = computed(
    () =>
      `rotate(${this.resolvedExpression().browRotationRight} ${BROW_RIGHT_X} ${this.geometry().browY})`,
  );

  protected readonly pupilLeftX = computed(
    () => PUPIL_LEFT_X + this.resolvedExpression().pupilOffsetX,
  );
  protected readonly pupilRightX = computed(
    () => PUPIL_RIGHT_X + this.resolvedExpression().pupilOffsetX,
  );
  protected readonly pupilY = computed(
    () => this.geometry().eyeY + this.resolvedExpression().pupilOffsetY,
  );

  protected readonly eyesOpacity = computed(() => (this.resolvedExpression().eyesClosed ? 0 : 1));
  protected readonly eyesClosedOpacity = computed(() =>
    this.resolvedExpression().eyesClosed ? 1 : 0,
  );
  protected readonly eyelidLeftPath = computed(
    () => `M${EYELID_LEFT_X} ${this.geometry().eyeY} q 6 4 12 0`,
  );
  protected readonly eyelidRightPath = computed(
    () => `M${EYELID_RIGHT_X} ${this.geometry().eyeY} q 6 4 12 0`,
  );
}
