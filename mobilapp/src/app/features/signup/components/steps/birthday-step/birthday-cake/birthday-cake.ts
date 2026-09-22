import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  FigureBandTone,
  FigureBody,
  FigureExpression,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../../../shared/components/figure';
import { CAKE_NUMBER_MIN_AGE, computeCakeGeometry } from './cake-geometry';

/** Aldersgrænsen i designet: under 16 år kan man ikke bruge appen. */
const MIN_AGE = 16;

/** Designets `bfig`-humør: glad når alderen er gyldig, ked af det når den er for lav. */
const MOOD_HAPPY = 0.8;
const MOOD_SAD = -1;
const MOOD_NEUTRAL = 0;

/** Designets `cakeOp`: kagen tones ned, når alderen mangler eller er for lav. */
const CAKE_OPACITY_FULL = 1;
const CAKE_OPACITY_TOO_YOUNG = 0.3;
const CAKE_OPACITY_UNSET = 0.25;

/** Hattens tre y-niveauer målt fra hovedets centrum. */
const HAT_BASE_OFFSET = -22;
const HAT_MID_OFFSET = -36;
const HAT_TIP_OFFSET = -56;
const TEAR_OFFSET = 6;

/** Pupillerne står ét punkt længere ude end standardfiguren på dette trin. */
const EXPRESSION: Partial<FigureExpression> = { pupilOffsetX: 1 };

/**
 * Fødselsdagsscenen: figuren med festhat rækker ud efter en lagkage, hvis størrelse og
 * antal lys følger alderen. Under 16 år falder hatten væk, figuren får en tåre, og
 * kagen tones ned.
 *
 * Scenen tegner selv sit SVG og bruger `FigureBody` til kroppen. Højre arm er slået fra,
 * fordi den erstattes af armen, der peger mod kagen (designets `cakeArm`).
 */
@Component({
  selector: 'app-birthday-cake',
  imports: [FigureBody],
  templateUrl: './birthday-cake.html',
  styleUrl: './birthday-cake.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'birthday-cake' },
})
export class BirthdayCake {
  readonly age = input.required<number>();
  readonly weightKg = input.required<number>();
  readonly heightCm = input.required<number>();
  readonly bandTone = input<FigureBandTone>('accent');
  readonly ageText = input('–');

  protected readonly expression = EXPRESSION;

  /** Designets `tooYoung`: en valgt dato, der giver en alder under 16. */
  protected readonly tooYoung = computed(() => this.age() > 0 && this.age() < MIN_AGE);

  protected readonly geometry = animatedFigure(() => {
    const mood = this.tooYoung() ? MOOD_SAD : this.age() >= MIN_AGE ? MOOD_HAPPY : MOOD_NEUTRAL;
    return computeFigureGeometry(this.weightKg(), this.heightCm(), mood);
  });

  protected readonly cake = computed(() => computeCakeGeometry(this.age()));

  protected readonly cakeOpacity = computed(() => {
    if (this.tooYoung()) {
      return CAKE_OPACITY_TOO_YOUNG;
    }
    return this.age() > 0 ? CAKE_OPACITY_FULL : CAKE_OPACITY_UNSET;
  });
  protected readonly hatOpacity = computed(() => (this.age() >= MIN_AGE ? 1 : 0));
  protected readonly tearOpacity = computed(() => (this.tooYoung() ? 1 : 0));
  protected readonly numberOpacity = computed(() => (this.age() > CAKE_NUMBER_MIN_AGE ? 1 : 0));

  protected readonly hatBaseY = computed(() => Math.round(this.geometry().headY + HAT_BASE_OFFSET));
  protected readonly hatMidY = computed(() => Math.round(this.geometry().headY + HAT_MID_OFFSET));
  protected readonly hatTipY = computed(() => Math.round(this.geometry().headY + HAT_TIP_OFFSET));
  protected readonly tearY = computed(() => Math.round(this.geometry().headY + TEAR_OFFSET));

  protected readonly hatPath = computed(
    () => `M84 ${this.hatBaseY()} L100 ${this.hatTipY()} L116 ${this.hatBaseY()} Z`,
  );
  protected readonly hatStripePath = computed(() => `M89 ${this.hatMidY()} L111 ${this.hatMidY()}`);

  /** Designets `cakeArm`: højre arm strækker sig op mod kagen. */
  protected readonly cakeArmPath = computed(() => {
    const g = this.geometry();
    const shoulderX = g.bodyX + g.bodyW - 10;
    const elbowX = g.bodyX + g.bodyW + 30;
    const handX = g.bodyX + g.bodyW + 40;
    return `M${shoulderX} ${g.bodyY + 22} Q${elbowX} ${g.bodyY + 10} ${handX} ${g.bodyY - 6}`;
  });
}
