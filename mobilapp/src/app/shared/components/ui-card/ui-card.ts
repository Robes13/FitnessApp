import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CardPadding = 'md' | 'lg';
export type CardTone = 'surface' | 'accent';

/**
 * Standard card: glass fill, soft hairline and 16 px radius. `accent` is the orange
 * gradient card ("Til mål") with dark text.
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
