import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * `pill` = 52 px tall, uppercase, sliding orange knob (Yes please / No thanks).
 * `compact` = 36 px tabs with a filled active tab (Items / Collections).
 */
export type SegmentedControlVariant = 'pill' | 'compact';

/** Gives each control its own radio `name`, so the browser groups the radios per control. */
let nextGroupId = 0;

/**
 * Segmented selection with radio-group semantics, built on native radio inputs: the browser
 * provides the arrow keys, the roving tab stop and the checked state. `value` is a two-way
 * `model` that is `null` until the user has selected – in the `pill` variant the knob is only
 * visible once there's a selection.
 *
 * The knob's position is pure CSS: the segment count and selected index are bound as CSS variables.
 */
@Component({
  selector: 'app-ui-segmented-control',
  templateUrl: './ui-segmented-control.html',
  styleUrl: './ui-segmented-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[class]': 'hostClasses()',
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--segment-count]': 'options().length',
    '[style.--segment-index]': 'knobIndex()',
  },
})
export class UiSegmentedControl<T extends string | number | boolean> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model<T | null>(null);
  readonly variant = input<SegmentedControlVariant>('pill');
  readonly ariaLabel = input<string | null>(null);

  protected readonly groupName = `ui-segmented-control-${nextGroupId++}`;

  /** Index of the selected segment, −1 when nothing is selected. */
  readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => option.value === this.value()),
  );

  protected readonly hasSelection = computed(() => this.selectedIndex() >= 0);
  protected readonly knobIndex = computed(() => Math.max(0, this.selectedIndex()));
  protected readonly hostClasses = computed(
    () => `ui-segmented-control ui-segmented-control--${this.variant()}`,
  );

  protected isSelected(index: number): boolean {
    return index === this.selectedIndex();
  }

  protected select(option: SegmentOption<T>): void {
    this.value.set(option.value);
  }
}
