import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { FigureBandTone, FigureBody, FigureExpression } from './figure-body';
import { animatedFigure } from './figure-motion';
import { computeFigureGeometry } from './figure-geometry';

/** The design's default aria-label for the figure. */
const DEFAULT_ARIA_LABEL = 'Figur';
const LAMP_X = 140;

/**
 * The whole figure as a finished SVG (`viewBox 0 0 200 300`, bottom-aligned): computes the
 * geometry from weight, height and mood and draws `FigureBody`. With `showCeiling`, the ceiling
 * and lamp are drawn from the height step; they're always in the DOM, just invisible below
 * 212 cm, so they can fade in.
 *
 * The host is `display: block` – the parent controls width/height (e.g. `flex: 1; max-width`).
 */
@Component({
  selector: 'app-figure',
  imports: [FigureBody],
  templateUrl: './figure.html',
  styleUrl: './figure.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'figure',
    '[class.figure--animated]': 'animated()',
  },
})
export class Figure {
  readonly weightKg = input.required<number>();
  readonly heightCm = input.required<number>();
  /** −1 sad … 0 neutral … 1 happy. */
  readonly mood = input(0);
  readonly bandTone = input<FigureBandTone>('accent');
  readonly showDumbbell = input(false, { transform: booleanAttribute });
  readonly showCeiling = input(false, { transform: booleanAttribute });
  readonly animated = input(true, { transform: booleanAttribute });
  readonly expression = input<Partial<FigureExpression>>({});
  readonly ariaLabel = input(DEFAULT_ARIA_LABEL);

  readonly geometry = animatedFigure(
    () => computeFigureGeometry(this.weightKg(), this.heightCm(), this.mood()),
    () => this.animated(),
  );

  protected readonly lampPath = computed(() => {
    const g = this.geometry();
    return `M124 ${g.lampY} L156 ${g.lampY} L150 ${g.lampY2} L130 ${g.lampY2} Z`;
  });
  protected readonly lampTransform = computed(() => {
    const g = this.geometry();
    return `rotate(${g.lampRot} ${LAMP_X} ${g.ceilY})`;
  });
}
