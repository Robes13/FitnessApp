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
 * Stroke-ikon fra `icon-registry.ts`. Farven følger `currentColor`, størrelsen sættes med
 * `size`. Ikonet er altid dekorativt (`aria-hidden`) – knappen omkring det bærer `aria-label`.
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
  /** Stregtykkelse i SVG-enheder (24×24 viewBox). */
  readonly strokeWidth = input(2, { transform: numberAttribute });

  protected readonly paths = computed(() => ICON_PATHS[this.name()]);
  protected readonly hostClasses = computed(() => `ui-icon ui-icon--${this.size()}`);
}
