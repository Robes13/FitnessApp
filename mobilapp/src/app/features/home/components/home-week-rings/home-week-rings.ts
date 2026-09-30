import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';
import { injectTranslate } from '../../../../core/services/language/translate';
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
  host: { class: 'home-week-rings', role: 'group', '[attr.aria-label]': 'ariaLabel()' },
})
export class HomeWeekRings {
  private readonly t = injectTranslate();
  // Bound rather than static, so the label follows the active language.
  protected readonly ariaLabel = computed(() => this.t('home.weekRings.ariaLabel'));

  readonly rings = input.required<readonly WeekRing[]>();
  /** The daily goal was just hit: today's ring closes with a pop and halo. */
  readonly celebrating = input(false, { transform: booleanAttribute });

  readonly selected = output<number>();
}
