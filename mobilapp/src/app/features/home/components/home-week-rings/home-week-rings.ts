import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { WeekRing } from '../../services/home-summary';

/**
 * The week's seven day rings. Each ring shows the day's share of the calorie goal; today
 * has an orange dot in the center, and the selected day gets a thin orange outer ring.
 * When the daily goal is celebrated, today's ring closes with a pop and a green halo.
 */
@Component({
  selector: 'app-home-week-rings',
  templateUrl: './home-week-rings.html',
  styleUrl: './home-week-rings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-week-rings', role: 'group', 'aria-label': 'Ugens dage' },
})
export class HomeWeekRings {
  readonly rings = input.required<readonly WeekRing[]>();
  /** The daily goal was just hit: today's ring closes with a pop and halo. */
  readonly celebrating = input(false, { transform: booleanAttribute });

  readonly selected = output<number>();
}
