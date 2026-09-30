import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import {
  FigureBandTone,
  FigureBody,
  FigureExpression,
  animatedFigure,
  computeFigureGeometry,
} from '../../../../../../shared/components/figure';
import { MIN_AGE } from '../../../../../../core/constants/nutrition';
import { CAKE_NUMBER_MIN_AGE, computeCakeGeometry } from './cake-geometry';

/** The design's `bfig` mood: happy when the age is valid, sad when it's too low. */
const MOOD_HAPPY = 0.8;
const MOOD_SAD = -1;
const MOOD_NEUTRAL = 0;

/** The design's `cakeOp`: the cake fades out when the age is missing or too low. */
const CAKE_OPACITY_FULL = 1;
const CAKE_OPACITY_TOO_YOUNG = 0.3;
const CAKE_OPACITY_UNSET = 0.25;

/** The hat's three y-levels measured from the head's centre. */
const HAT_BASE_OFFSET = -22;
const HAT_MID_OFFSET = -36;
const HAT_TIP_OFFSET = -56;
const TEAR_OFFSET = 6;

/** The pupils sit one point further out than the default figure at this step. */
const EXPRESSION: Partial<FigureExpression> = { pupilOffsetX: 1 };

/**
 * The birthday scene: the figure wearing a party hat reaches for a layer cake whose size and
 * number of candles follow the age. Under 16, the hat disappears, the figure gets a tear, and
 * the cake fades out.
 *
 * The scene draws its own SVG and uses `FigureBody` for the body. The right arm is disabled,
 * because it's replaced by the arm pointing at the cake (the design's `cakeArm`).
 */
@Component({
  selector: 'app-birthday-cake',
  imports: [FigureBody, TranslatePipe],
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

  /** The design's `tooYoung`: a chosen date that yields an age under 16. */
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

  /** The design's `cakeArm`: the right arm stretches up towards the cake. */
  protected readonly cakeArmPath = computed(() => {
    const g = this.geometry();
    const shoulderX = g.bodyX + g.bodyW - 10;
    const elbowX = g.bodyX + g.bodyW + 30;
    const handX = g.bodyX + g.bodyW + 40;
    return `M${shoulderX} ${g.bodyY + 22} Q${elbowX} ${g.bodyY + 10} ${handX} ${g.bodyY - 6}`;
  });
}
