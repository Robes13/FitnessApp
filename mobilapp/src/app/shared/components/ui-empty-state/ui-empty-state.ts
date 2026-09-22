import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** `subtle` er designets svagere hint inde i et ark (lysere stiplet kant, dæmpet tekst). */
export type EmptyStateTone = 'default' | 'subtle';
/** 13 / 12 px – `--font-size-md` / `-sm`. */
export type EmptyStateSize = 'md' | 'sm';

/** Tom tilstand: stiplet boks med en kort forklarende tekst. */
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
