import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/**
 * `selected` = blå kant + blå tone (designets `sel()`: mål, tempo, intensitet).
 * `accent` = orange kant, orange fyld og orange tekst (designets `editOptions`).
 * `accent-radio` = orange kant og et svagere fyld plus en rund radio-prik til højre, der
 * fyldes, når kortet er valgt (designets `gendersBig`).
 */
export type OptionCardSelectionStyle = 'selected' | 'accent' | 'accent-radio';
/** `row` = designets `.opt` (68 px), `column` = intensitets-flisen med indikator øverst. */
export type OptionCardLayout = 'row' | 'column';
/** `regular` = 68 px, `compact` = 58 px (designets valgkort i redigeringsarket). */
export type OptionCardDensity = 'regular' | 'compact';

/**
 * Valgkort med label og beskrivelse. Bruges som attribut på en `<button>`, så native
 * `disabled` og tastaturstyring følger med. Valget ejes af forælderen (`selected`), og
 * kortet rapporterer via det almindelige `(click)`.
 *
 * Slots: `[optionLeading]` (før teksten – i `column` øverst) og `[optionTrailing]`
 * (efter teksten, fx et glyf eller en pris).
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
