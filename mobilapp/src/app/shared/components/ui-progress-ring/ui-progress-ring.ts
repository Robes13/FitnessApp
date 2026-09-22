import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { Tone } from '../../../core/models/tone';
import { clampFraction } from '../ui-progress-bar/ui-progress-bar';

export type ProgressRingTrackTone = 'line' | 'neutral' | 'none';

const DEFAULT_DIAMETER = 48;
const DEFAULT_STROKE_WIDTH = 4;
const PERCENT_MAX = 100;

/**
 * Cirkulær fremdriftsring (dagsringe, kaloriering, trin-tæller, badges).
 *
 * Ringen tegnes med `stroke-dasharray` = omkredsen og `stroke-dashoffset` =
 * omkreds × (1 − value), roteret −90° så den starter i toppen. Indhold i midten
 * projiceres via `<ng-content>`. Størrelsen bindes som `--ring-size`.
 */
@Component({
  selector: 'app-ui-progress-ring',
  templateUrl: './ui-progress-ring.html',
  styleUrl: './ui-progress-ring.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-progress-ring',
    role: 'progressbar',
    '[style.--ring-size.px]': 'diameter()',
    '[attr.aria-valuemin]': 'percentMin',
    '[attr.aria-valuemax]': 'percentMax',
    '[attr.aria-valuenow]': 'percent()',
  },
})
export class UiProgressRing {
  /** Andel 0..1 (klemmes fast). */
  readonly value = input(0);
  /** Ydre diameter i px – bruges både som viewBox og som CSS-størrelse. */
  readonly diameter = input(DEFAULT_DIAMETER, { transform: numberAttribute });
  /** Stregtykkelse i px (= SVG-enheder, da viewBox følger diameteren). */
  readonly strokeWidth = input(DEFAULT_STROKE_WIDTH, { transform: numberAttribute });
  readonly tone = input<Tone>('accent');
  readonly trackTone = input<ProgressRingTrackTone>('line');
  readonly animated = input(true, { transform: booleanAttribute });

  protected readonly percentMin = 0;
  protected readonly percentMax = PERCENT_MAX;

  readonly percent = computed(() => Math.round(clampFraction(this.value()) * PERCENT_MAX));
  readonly center = computed(() => this.diameter() / 2);
  /** Radius til stregens midte, så stregen holder sig inden for viewBox. */
  readonly radius = computed(() => Math.max(0, (this.diameter() - this.strokeWidth()) / 2));
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  /** Den del af omkredsen, der *ikke* tegnes: omkreds × (1 − value). */
  readonly dashOffset = computed(() => this.circumference() * (1 - clampFraction(this.value())));

  protected readonly viewBox = computed(() => `0 0 ${this.diameter()} ${this.diameter()}`);
  protected readonly hasTrack = computed(() => this.trackTone() !== 'none');
  protected readonly trackClass = computed(() => `ui-progress-ring__track--${this.trackTone()}`);
  protected readonly valueClass = computed(() =>
    this.animated()
      ? `ui-progress-ring__value--${this.tone()} ui-progress-ring__value--animated`
      : `ui-progress-ring__value--${this.tone()}`,
  );
}
