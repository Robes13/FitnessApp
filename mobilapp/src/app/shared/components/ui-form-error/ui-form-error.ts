import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FormErrorTone = 'accent' | 'negative' | 'positive';

/**
 * Hint/error line below a field. Always reserves its height (the design's `min-height:16px`),
 * so the layout doesn't jump when the text appears and disappears. `role="status"` makes
 * screen readers announce the text when it changes.
 */
@Component({
  selector: 'app-ui-form-error',
  templateUrl: './ui-form-error.html',
  styleUrl: './ui-form-error.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'status',
    'aria-live': 'polite',
    '[class]': 'hostClasses()',
  },
})
export class UiFormError {
  readonly message = input<string | null | undefined>(null);
  readonly tone = input<FormErrorTone>('accent');

  protected readonly hostClasses = computed(() => `ui-form-error ui-form-error--${this.tone()}`);
}
