import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardTone = 'surface' | 'soft' | 'accent';

/**
 * Standardkort: glas-fyld, blød hairline og 16 px radius. `accent` er det orange
 * gradient-kort ("Til mål") med mørk tekst.
 */
@Component({
  selector: 'app-ui-card',
  templateUrl: './ui-card.html',
  styleUrl: './ui-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-card',
    '[class]': 'hostClass()',
  },
})
export class UiCard {
  readonly padding = input<CardPadding>('md');
  readonly tone = input<CardTone>('surface');

  protected readonly hostClass = computed(
    () => `ui-card--padding-${this.padding()} ui-card--${this.tone()}`,
  );
}
