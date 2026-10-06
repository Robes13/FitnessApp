import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { injectTranslate } from '../../../core/services/language/translate';
import { FigureBandTone, FigureBody } from './figure-body';
import { animatedFigure } from './figure-motion';
import { computeFigureGeometry } from './figure-geometry';

/** The design's default aria-label for the figure. */
const DEFAULT_ARIA_LABEL_KEY = 'shared.figure.ariaLabel';
const LAMP_X = 140;

/**
 * The whole figure as a finished SVG (`viewBox 0 0 200 300`, bottom-aligned): computes the
 * geometry from weight and height and draws `FigureBody`. With `showCeiling`, the ceiling
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
  host: { class: 'figure' },
})
export class Figure {
  readonly weightKg = input.required<number>();
  readonly heightCm = input.required<number>();
  readonly bandTone = input<FigureBandTone>('accent');
  readonly showDumbbell = input(false, { transform: booleanAttribute });
  readonly showCeiling = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string>();

  private readonly t = injectTranslate();
  protected readonly ariaLabelText = computed(
    () => this.ariaLabel() ?? this.t(DEFAULT_ARIA_LABEL_KEY),
  );

  readonly geometry = animatedFigure(() => computeFigureGeometry(this.weightKg(), this.heightCm()));

  protected readonly lampPath = computed(() => {
    const g = this.geometry();
    return `M124 ${g.lampY} L156 ${g.lampY} L150 ${g.lampY2} L130 ${g.lampY2} Z`;
  });
  protected readonly lampTransform = computed(() => {
    const g = this.geometry();
    return `rotate(${g.lampRot} ${LAMP_X} ${g.ceilY})`;
  });
}
