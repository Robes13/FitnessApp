import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { Achievement } from '../../services/achievements';

/** The badge's outer size in px – the ring is drawn in the same coordinate system. */
const MEDAL_DIAMETER = 56;
const MEDAL_STROKE_WIDTH = 3;

interface AchievementView extends Achievement {
  readonly toneClass: string;
}

/**
 * The achievements grid (4 columns). Each badge is a circle with a glyph, a ring showing
 * progress, and a status underneath. Achieved badges are shown in full color; locked ones
 * are muted and show how far there is left.
 *
 * The ring is only drawn when the badge is **not** achieved – as in the design, where
 * `arcOp` becomes 0: the colored border around the circle alone signals that the goal was
 * reached.
 */
@Component({
  selector: 'app-achievements',
  imports: [UiIcon, UiProgressRing],
  templateUrl: './achievements.html',
  styleUrl: './achievements.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'achievements' },
})
export class Achievements {
  readonly achievements = input.required<readonly Achievement[]>();

  protected readonly medalDiameter = MEDAL_DIAMETER;
  protected readonly medalStrokeWidth = MEDAL_STROKE_WIDTH;

  protected readonly items = computed<readonly AchievementView[]>(() =>
    this.achievements().map((achievement) => ({
      ...achievement,
      toneClass: `achievements__item--${achievement.tone}`,
    })),
  );
}
