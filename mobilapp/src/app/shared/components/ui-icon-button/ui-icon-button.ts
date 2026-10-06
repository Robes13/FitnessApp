import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** 56 / 52 / 48 / 44 / 40 / 36 / 26 px – `--size-control-xl` … `-2xs` and `-4xs`. */
export type UiIconButtonSize = 'xl' | 'lg' | 'md' | 'sm' | 'xs' | '2xs' | '4xs';
/** `ghost` is fully transparent (the design's small re-log button in history). */
export type UiIconButtonTone = 'neutral' | 'ghost' | 'accent' | 'translucent' | 'outline';

/**
 * The design's round `.circ` button. Used as an attribute on a native `<button>` with an
 * `<app-ui-icon>` as content. The button is icon-only, so it **must** have `aria-label`.
 */
@Component({
  selector: 'button[app-ui-icon-button]',
  templateUrl: './ui-icon-button.html',
  styleUrl: './ui-icon-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
  },
})
export class UiIconButton {
  readonly size = input<UiIconButtonSize>('xl');
  readonly tone = input<UiIconButtonTone>('neutral');

  protected readonly hostClasses = computed(
    () => `ui-icon-button ui-icon-button--${this.size()} ui-icon-button--${this.tone()}`,
  );
}
