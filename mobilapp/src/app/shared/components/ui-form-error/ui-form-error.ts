import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type FormErrorTone = 'accent' | 'negative' | 'positive';

/**
 * Hint-/fejllinje under et felt. Reserverer altid sin højde (designets `min-height:16px`),
 * så layoutet ikke hopper, når teksten kommer og går. `role="status"` gør, at skærmlæsere
 * læser teksten op, når den ændrer sig.
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
