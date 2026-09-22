import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { FigureGeometry } from './figure-geometry';

/** Pandebåndets farve – køn, fremgang og træningsintensitet farver det forskelligt. */
export type FigureBandTone =
  'accent' | 'pink' | 'white' | 'positive' | 'negative' | 'muted' | 'accent-strong' | 'accent-deep';

/** Kindernes farve – bliver rødere ved højere intensitet. */
export type FigureCheekTone = 'accent' | 'accent-soft' | 'negative' | 'negative-strong';

/**
 * Ansigtsudtrykket. Alle felter har standardværdier fra geometrien (smil, åben mund og bryn
 * følger vægten), så en scene kun overskriver det, den vil styre.
 */
export interface FigureExpression {
  readonly smileOpacity: number;
  readonly mouthRx: number;
  readonly mouthRy: number;
  readonly tongueRx: number;
  readonly tongueRy: number;
  /** Venstre bryns rotation i grader. */
  readonly browRotation: number;
  /** Højre bryns rotation i grader. */
  readonly browRotationRight: number;
  readonly browOpacity: number;
  readonly cheekTone: FigureCheekTone;
  readonly cheekRadius: number;
  /** Pupillernes forskydning i SVG-enheder (figuren "kigger" til siden / ned). */
  readonly pupilOffsetX: number;
  readonly pupilOffsetY: number;
  /** Lukkede øjne (to buer) i stedet for øjne med pupiller. */
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

/** Standardudtrykket: designets grundfigur, hvor mund og bryn styres af geometrien. */
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
 * Figurens krop som attribut-komponent på et SVG `<g>`:
 *
 * ```html
 * <svg viewBox="0 0 200 300"><g app-figure-body [geometry]="geometry()" /></svg>
 * ```
 *
 * Tegner skygge, ben, sko, arme, krop, bælte, (håndvægt) og hoved i designets rækkefølge.
 * Alle farver er `--color-figure-*`-tokens via klasser; scener slår enkeltdele fra
 * (`showLeftArm`, `showRightArm`, `showHead`, `showShadow`) og tegner deres egne animerede
 * varianter ovenpå. `expression` overskriver ansigtets standardudtryk felt for felt.
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
  readonly showLeftArm = input(true, { transform: booleanAttribute });
  readonly showRightArm = input(true, { transform: booleanAttribute });
  readonly showHead = input(true, { transform: booleanAttribute });
  readonly showShadow = input(true, { transform: booleanAttribute });
  /** Dybdeskygge som i træningsscenerne: venstre ben/arm/sko mørkere, højre arm lysere. */
  readonly shaded = input(false, { transform: booleanAttribute });
  /** Bløde overgange (designets `.35s ease`), når geometrien ændrer sig. */
  readonly animated = input(true, { transform: booleanAttribute });
  readonly expression = input<Partial<FigureExpression>>({});

  /** Det fulde udtryk: standardværdier fra geometrien overskrevet af `expression`. */
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
