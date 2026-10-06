import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IsActiveMatchOptions,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { injectTranslate } from '../../../core/services/language/translate';
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';

export interface TabBarItem {
  readonly label: string;
  readonly icon: IconName;
  /** Absolute path from `APP_PATH`. */
  readonly path: string;
}

const DEFAULT_ARIA_LABEL_KEY = 'shared.tabBar.ariaLabel';

/** An item is active when its path is a prefix of the current URL (`/collection/x` → Collection). */
const ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

/**
 * The bottom navigation: a pill with five equally wide cells and an orange knob that slides
 * behind the active cell. The active icon turns dark, and its label collapses.
 *
 * The knob's position is pure CSS based on `--tab-count` and `--tab-index`, which are computed by
 * `Router.isActive` after each navigation.
 */
@Component({
  selector: 'app-ui-tab-bar',
  imports: [RouterLink, RouterLinkActive, UiIcon],
  templateUrl: './ui-tab-bar.html',
  styleUrl: './ui-tab-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'ui-tab-bar',
    role: 'navigation',
    '[attr.aria-label]': 'ariaLabelText()',
    '[style.--tab-count]': 'items().length',
    '[style.--tab-index]': 'knobIndex()',
  },
})
export class UiTabBar {
  readonly items = input.required<readonly TabBarItem[]>();

  private readonly router = inject(Router);
  private readonly t = injectTranslate();

  protected readonly ariaLabelText = computed(() => this.t(DEFAULT_ARIA_LABEL_KEY));

  /** The latest URL after a completed navigation – used only as a trigger for `activeIndex`. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Index of the active item, −1 when no path matches. */
  readonly activeIndex = computed(() => {
    // Read to recompute after each navigation; the router does the actual matching.
    this.currentUrl();
    return this.items().findIndex((item) => this.router.isActive(item.path, ACTIVE_MATCH));
  });

  protected readonly hasActive = computed(() => this.activeIndex() >= 0);
  protected readonly knobIndex = computed(() => Math.max(0, this.activeIndex()));
  protected readonly linkActiveOptions = { exact: false };
}
