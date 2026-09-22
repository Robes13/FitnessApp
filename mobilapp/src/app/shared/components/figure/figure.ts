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

/** Designets standard-aria-label for figuren. */
const DEFAULT_ARIA_LABEL = 'Figur';
const LAMP_X = 140;

/**
 * Hele figuren som færdig SVG (`viewBox 0 0 200 300`, bundjusteret): beregner geometrien ud fra
 * vægt, højde og humør og tegner `FigureBody`. Med `showCeiling` tegnes loftet og lampen fra
 * højdetrinnet; de er altid i DOM'en, men usynlige under 212 cm, så de kan fade ind.
 *
 * Værten er `display: block` – forælderen styrer bredde/højde (fx `flex: 1; max-width`).
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
  /** −1 ked af det … 0 neutral … 1 glad. */
  readonly mood = input(0);
  readonly bandTone = input<FigureBandTone>('accent');
  readonly showDumbbell = input(false, { transform: booleanAttribute });
  readonly showCeiling = input(false, { transform: booleanAttribute });
  readonly animated = input(true, { transform: booleanAttribute });
  readonly expression = input<Partial<FigureExpression>>({});
  readonly ariaLabel = input(DEFAULT_ARIA_LABEL);

  readonly geometry = animatedFigure(() =>
    computeFigureGeometry(this.weightKg(), this.heightCm(), this.mood()),
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
