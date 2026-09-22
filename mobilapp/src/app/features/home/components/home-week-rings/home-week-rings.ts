import { ChangeDetectionStrategy, Component, booleanAttribute, input, output } from '@angular/core';
import { WeekRing } from '../../services/home-summary';

/**
 * Ugens syv dagsringe. Hver ring viser dagens andel af kaloriemålet; i dag har en orange
 * prik i midten, og den valgte dag en tynd orange yderring. Fejres dagsmålet, lukker dagens
 * ring med et pop og en grøn halo.
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
  /** Dagsmålet er lige nået: dagens ring lukker med pop og halo. */
  readonly celebrating = input(false, { transform: booleanAttribute });

  readonly selected = output<number>();
}
