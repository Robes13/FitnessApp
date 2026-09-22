import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { Achievement } from '../../services/achievements';

/** Badgets ydre mål i px – ringen tegnes i samme koordinatsystem. */
const MEDAL_DIAMETER = 56;
const MEDAL_STROKE_WIDTH = 3;

interface AchievementView extends Achievement {
  readonly toneClass: string;
}

/**
 * Gitteret med præstationer (4 kolonner). Hvert badge er en cirkel med et tegn, en ring, der
 * viser fremdriften, og en status nedenunder. Klarede badges står i fuld farve; låste er
 * nedtonede og viser, hvor langt der er igen.
 *
 * Ringen tegnes kun, når badget **ikke** er klaret – som i designet, hvor `arcOp` bliver 0:
 * den farvede kant om cirklen fortæller alene, at målet er nået.
 */
@Component({
  selector: 'app-achievements',
  imports: [UiProgressRing],
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
