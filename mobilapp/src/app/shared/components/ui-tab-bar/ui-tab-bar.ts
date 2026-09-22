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
import { IconName } from '../ui-icon/icon-registry';
import { UiIcon } from '../ui-icon/ui-icon';

export interface TabBarItem {
  readonly label: string;
  readonly icon: IconName;
  /** Absolut sti fra `APP_PATH`. */
  readonly path: string;
}

const DEFAULT_ARIA_LABEL = 'Hovednavigation';

/** Et punkt er aktivt, når dets sti er et præfiks af den aktuelle URL (`/samling/x` → Samling). */
const ACTIVE_MATCH: IsActiveMatchOptions = {
  paths: 'subset',
  queryParams: 'ignored',
  fragment: 'ignored',
  matrixParams: 'ignored',
};

/**
 * Bundnavigationen: en pille med fem lige brede celler og en orange knop, der glider bag
 * den aktive celle. Det aktive ikon bliver mørkt, og dens label klappes sammen.
 *
 * Knoppens position er ren CSS ud fra `--tab-count` og `--tab-index`, som beregnes af
 * `Router.isActive` efter hver navigation.
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
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--tab-count]': 'items().length',
    '[style.--tab-index]': 'knobIndex()',
  },
})
export class UiTabBar {
  readonly items = input.required<readonly TabBarItem[]>();
  readonly ariaLabel = input(DEFAULT_ARIA_LABEL);

  private readonly router = inject(Router);

  /** Seneste URL efter en afsluttet navigation – kun brugt som trigger for `activeIndex`. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Indeks for det aktive punkt, −1 når ingen sti matcher. */
  readonly activeIndex = computed(() => {
    // Læses for at genberegne efter hver navigation; selve matchet laver routeren.
    this.currentUrl();
    return this.items().findIndex((item) => this.router.isActive(item.path, ACTIVE_MATCH));
  });

  protected readonly hasActive = computed(() => this.activeIndex() >= 0);
  protected readonly knobIndex = computed(() => Math.max(0, this.activeIndex()));
  protected readonly linkActiveOptions = { exact: false };
}
