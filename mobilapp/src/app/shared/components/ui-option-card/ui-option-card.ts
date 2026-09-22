import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/**
 * `selected` = blue border + blue tone (the design's `sel()`: goal, pace, intensity).
 * `accent` = orange border, orange fill and orange text (the design's `editOptions`).
 * `accent-radio` = orange border and a weaker fill plus a round radio dot on the right, which
 * fills when the card is selected (the design's `gendersBig`).
 */
export type OptionCardSelectionStyle = 'selected' | 'accent' | 'accent-radio';
/** `row` = the design's `.opt` (68 px), `column` = the intensity tile with indicator on top. */
export type OptionCardLayout = 'row' | 'column';
/** `regular` = 68 px, `compact` = 58 px (the design's option card in the edit sheet). */
export type OptionCardDensity = 'regular' | 'compact';

/**
 * Option card with a label and description. Used as an attribute on a `<button>`, so native
 * `disabled` and keyboard handling come for free. Selection is owned by the parent (`selected`),
 * and the card reports back via the regular `(click)`.
 *
 * Slots: `[optionLeading]` (before the text – on top in `column`) and `[optionTrailing]`
 * (after the text, e.g. a glyph or a price).
 */
@Component({
  selector: 'button[app-ui-option-card]',
  templateUrl: './ui-option-card.html',
  styleUrl: './ui-option-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-option-card',
    type: 'button',
    '[class]': 'hostClass()',
    '[attr.aria-pressed]': 'selected()',
  },
})
export class UiOptionCard {
  readonly label = input.required<string>();
  readonly description = input('');
  readonly selected = input(false, { transform: booleanAttribute });
  readonly selectionStyle = input<OptionCardSelectionStyle>('selected');
  readonly layout = input<OptionCardLayout>('row');
  readonly density = input<OptionCardDensity>('regular');

  protected readonly hasRadio = computed(() => this.selectionStyle() === 'accent-radio');

  protected readonly hostClass = computed(() => {
    const classes = [
      `ui-option-card--${this.layout()}`,
      `ui-option-card--${this.density()}`,
      `ui-option-card--style-${this.selectionStyle()}`,
    ];
    if (this.selected()) {
      classes.push('ui-option-card--selected');
    }
    return classes.join(' ');
  });
}
