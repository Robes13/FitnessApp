import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  viewChildren,
} from '@angular/core';

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

/**
 * `pill` = 52 px tall, uppercase, sliding orange knob (Yes please / No thanks).
 * `compact` = 36 px tabs with a filled active tab (Items / Collections).
 */
export type SegmentedControlVariant = 'pill' | 'compact';

/** Arrow keys move the selection as in a native radio group. */
const KEY_DELTAS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/**
 * Segmented selection with radio-group semantics. `value` is a two-way `model` that is `null`
 * until the user has selected – in the `pill` variant the knob is only visible once there's a
 * selection.
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
    '(keydown)': 'onKeydown($event)',
  },
})
export class UiSegmentedControl<T extends string | number | boolean> {
  readonly options = input.required<readonly SegmentOption<T>[]>();
  readonly value = model<T | null>(null);
  readonly variant = input<SegmentedControlVariant>('pill');
  readonly ariaLabel = input<string | null>(null);

  private readonly segments = viewChildren<ElementRef<HTMLButtonElement>>('segment');

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

  /** Only the selected segment (or the first, when nothing is selected) is in the tab order. */
  protected tabIndexFor(index: number): number {
    const selected = this.selectedIndex();
    const focusable = selected < 0 ? index === 0 : index === selected;
    return focusable ? 0 : -1;
  }

  protected select(option: SegmentOption<T>): void {
    this.value.set(option.value);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const delta = KEY_DELTAS[event.key];
    const options = this.options();
    if (delta === undefined || options.length === 0) {
      return;
    }
    event.preventDefault();
    const current = this.selectedIndex();
    const next = current < 0 ? 0 : (current + delta + options.length) % options.length;
    const option = options[next];
    if (option === undefined) {
      return;
    }
    this.value.set(option.value);
    this.segments()[next]?.nativeElement.focus();
  }
}
