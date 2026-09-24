import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';
import { ROUTE_DATA } from '../../../../core/constants/route-data';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { UiTabBar } from '../../../../shared/components/ui-tab-bar/ui-tab-bar';
import { TAB_BAR_ITEMS } from '../../shell-navigation';

/**
 * The frame around the tab screens: a `<router-outlet>` for the active page and the tab
 * bar at the bottom. The tab bar is hidden when the deepest active route has
 * `data: { hideTabBar: true }` – this is determined on creation and after every completed
 * navigation by walking the snapshot tree (`ActivatedRouteSnapshot.firstChild`) to the
 * bottom. The snapshot tree is complete before the shell is created; `ActivatedRoute.firstChild`
 * is not.
 *
 * The tab bar is also hidden while the on-screen keyboard is open – as in native iOS apps, the
 * keyboard takes its place, and the screen above keeps all the room for the focused field.
 */
@Component({
  selector: 'app-shell-layout',
  imports: [RouterOutlet, UiTabBar],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'shell-layout' },
})
export class ShellLayout {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly keyboard = inject(KeyboardService);

  protected readonly tabBarItems = TAB_BAR_ITEMS;

  private readonly tabBarHidden = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.deepestRouteHidesTabBar()),
    ),
    { initialValue: this.deepestRouteHidesTabBar() },
  );

  protected readonly showTabBar = computed(() => !this.tabBarHidden() && !this.keyboard.isOpen());

  private deepestRouteHidesTabBar(): boolean {
    let deepest: ActivatedRouteSnapshot = this.route.snapshot;
    while (deepest.firstChild) {
      deepest = deepest.firstChild;
    }
    return deepest.data[ROUTE_DATA.HIDE_TAB_BAR] === true;
  }
}
