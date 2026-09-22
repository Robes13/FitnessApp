import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { UiSpinner } from '../ui-spinner/ui-spinner';

/**
 * `outline` is transparent with a hairline, `surface` puts a glass fill behind the same
 * hairline (design's "Search item"/"Scan" and the photo sheet's secondary buttons), and
 * `outline-danger` is a hairline with red text (design's "Log out").
 */
export type UiButtonVariant =
  'primary' | 'outline' | 'surface' | 'outline-danger' | 'ghost' | 'danger' | 'subtle';
/** 56 / 52 / 48 / 44 px – `--size-control-xl` / `-lg` / `-md` / `-sm`. */
export type UiButtonSize = 'xl' | 'lg' | 'md' | 'sm';
/** `pill` is the design's default button; `rounded` is the low 14 px radius (the photo sheet). */
export type UiButtonShape = 'pill' | 'rounded';

/**
 * Design's `.pill` button and its variants. Used as an attribute on a native `<button>`
 * or `<a>`, so native `disabled`, `type` and routerLink still work unchanged.
 *
 * `loading` shows a `UiSpinner`, sets `aria-busy`/`aria-disabled` and blocks clicks while
 * work is in progress.
 *
 * If the design deviates from the size scale on a single screen, the parent can set
 * `--ui-button-min-height` on the button instead of copying the whole button's styling.
 */
@Component({
  selector: 'button[app-ui-button], a[app-ui-button]',
  imports: [UiSpinner],
  templateUrl: './ui-button.html',
  styleUrl: './ui-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[class.ui-button--block]': 'block()',
    '[class.ui-button--loading]': 'loading()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.aria-disabled]': 'loading() || null',
    '(click)': 'onClick($event)',
  },
})
export class UiButton {
  readonly variant = input<UiButtonVariant>('primary');
  readonly size = input<UiButtonSize>('xl');
  readonly shape = input<UiButtonShape>('pill');
  /** Fills the full width. */
  readonly block = input(false, { transform: booleanAttribute });
  /** Shows a spinner and blocks clicks. */
  readonly loading = input(false, { transform: booleanAttribute });

  protected readonly hostClasses = computed(
    () =>
      `ui-button ui-button--${this.variant()} ui-button--${this.size()} ui-button--${this.shape()}`,
  );

  protected onClick(event: Event): void {
    if (this.loading()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
