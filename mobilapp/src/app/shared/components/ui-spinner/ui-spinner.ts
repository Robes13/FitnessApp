import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { injectTranslate } from '../../../core/services/language/translate';

/** 16 / 24 / 44 px – `--size-icon-sm` / `--size-icon-2xl` / `--size-control-sm`. */
export type SpinnerSize = 'sm' | 'md' | 'lg';
/** `accent` = orange top on a gray track (default); `current` = follows the text color (in buttons). */
export type SpinnerTone = 'accent' | 'current';

const DEFAULT_LABEL_KEY = 'shared.spinner.loading';

/** Rotating ring with an orange top (the design's `dcspin`). The host is the ring itself. */
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
    '[attr.aria-label]': 'ariaLabelText()',
  },
})
export class UiSpinner {
  readonly size = input<SpinnerSize>('md');
  readonly tone = input<SpinnerTone>('accent');
  readonly ariaLabel = input<string>();

  private readonly t = injectTranslate();
  protected readonly ariaLabelText = computed(() => this.ariaLabel() ?? this.t(DEFAULT_LABEL_KEY));

  protected readonly hostClass = computed(
    () => `ui-spinner--${this.size()} ui-spinner--${this.tone()}`,
  );
}
