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
 * Filter/selection chip (All · Weight · Food, meals, weight ranges). Used as an attribute on
 * a native `<button>`; the content is projected. Selected = orange border, orange tint and orange text.
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
    '[attr.aria-pressed]': 'selected()',
  },
})
export class UiChip {
  readonly selected = input(false, { transform: booleanAttribute });
  readonly size = input<UiChipSize>('md');

  protected readonly hostClasses = computed(() => `ui-chip ui-chip--${this.size()}`);
}
