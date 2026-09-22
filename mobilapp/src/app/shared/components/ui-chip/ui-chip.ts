import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';

/** 40 / 36 px – `--size-control-xs` / `-2xs`. */
export type UiChipSize = 'md' | 'sm';

/**
 * Filter-/valg-chip (Alle · Vejning · Mad, måltider, vægt-intervaller). Bruges som attribut på
 * en native `<button>`; indholdet projiceres. Valgt = orange kant, orange skær og orange tekst.
 */
@Component({
  selector: 'button[app-ui-chip]',
  templateUrl: './ui-chip.html',
  styleUrl: './ui-chip.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    type: 'button',
    '[class]': 'hostClasses()',
    '[class.ui-chip--selected]': 'selected()',
    '[class.ui-chip--filled]': 'filled()',
    '[attr.aria-pressed]': 'selected()',
  },
})
export class UiChip {
  readonly selected = input(false, { transform: booleanAttribute });
  readonly size = input<UiChipSize>('md');
  /** Uvalgt chip får glas-fyld i stedet for at være gennemsigtig (ikon-gitteret i Ny samling). */
  readonly filled = input(false, { transform: booleanAttribute });

  protected readonly hostClasses = computed(() => `ui-chip ui-chip--${this.size()}`);
}
