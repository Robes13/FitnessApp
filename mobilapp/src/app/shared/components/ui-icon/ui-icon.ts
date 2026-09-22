import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { ICON_PATHS, IconName } from './icon-registry';

/** 12 / 14 / 16 / 18 / 20 / 22 / 24 / 26 / 64 px – `--size-icon-*`. */
export type UiIconSize = '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'hero';

/**
 * Stroke icon from `icon-registry.ts`. The color follows `currentColor`, the size is set with
 * `size`. The icon is always decorative (`aria-hidden`) – the button around it carries `aria-label`.
 */
@Component({
  selector: 'app-ui-icon',
  templateUrl: './ui-icon.html',
  styleUrl: './ui-icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[class]': 'hostClasses()',
  },
})
export class UiIcon {
  readonly name = input.required<IconName>();
  readonly size = input<UiIconSize>('md');
  /** Stroke width in SVG units (24×24 viewBox). */
  readonly strokeWidth = input(2, { transform: numberAttribute });

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
  protected readonly hostClasses = computed(() => `ui-icon ui-icon--${this.size()}`);
}
