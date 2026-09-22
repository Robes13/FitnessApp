import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 16 / 24 / 44 px – `--size-icon-sm` / `--size-icon-2xl` / `--size-control-sm`. */
export type SpinnerSize = 'sm' | 'md' | 'lg';
/** `accent` = orange top på grå skinne (standard); `current` = følger tekstfarven (i knapper). */
export type SpinnerTone = 'accent' | 'current';

const DEFAULT_LABEL = 'Indlæser…';

/** Roterende ring med orange top (designets `dcspin`). Værten er selv ringen. */
@Component({
  selector: 'app-ui-spinner',
  templateUrl: './ui-spinner.html',
  styleUrl: './ui-spinner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-spinner',
    role: 'status',
    'aria-live': 'polite',
    '[class]': 'hostClass()',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class UiSpinner {
  readonly size = input<SpinnerSize>('md');
  readonly tone = input<SpinnerTone>('accent');
  readonly ariaLabel = input(DEFAULT_LABEL);

  protected readonly hostClass = computed(
    () => `ui-spinner--${this.size()} ui-spinner--${this.tone()}`,
  );
}
