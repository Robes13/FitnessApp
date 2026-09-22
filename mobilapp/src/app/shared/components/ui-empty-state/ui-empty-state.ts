import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** `subtle` is the design's weaker hint inside a sheet (lighter dashed border, muted text). */
export type EmptyStateTone = 'default' | 'subtle';
/** 13 / 12 px – `--font-size-md` / `-sm`. */
export type EmptyStateSize = 'md' | 'sm';

/** Empty state: dashed box with a short explanatory text. */
@Component({
  selector: 'app-ui-empty-state',
  templateUrl: './ui-empty-state.html',
  styleUrl: './ui-empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClasses()' },
})
export class UiEmptyState {
  readonly message = input.required<string>();
  readonly tone = input<EmptyStateTone>('default');
  readonly size = input<EmptyStateSize>('md');

  protected readonly hostClasses = computed(
    () => `ui-empty-state ui-empty-state--${this.tone()} ui-empty-state--${this.size()}`,
  );
}
