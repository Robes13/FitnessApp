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
import { UiTabBar } from '../../../../shared/components/ui-tab-bar/ui-tab-bar';
import { TAB_BAR_ITEMS } from '../../shell-navigation';

/**
 * Rammen om tab-skærmene: en `<router-outlet>` til den aktive side og tab baren nederst.
 * Tab baren skjules, når den dybeste aktive rute har `data: { hideTabBar: true }` – det
 * afgøres ved oprettelsen og efter hver afsluttet navigation ved at følge snapshot-træet
 * (`ActivatedRouteSnapshot.firstChild`) til bunden. Snapshot-træet er komplet, før shell'en
 * oprettes; `ActivatedRoute.firstChild` er det ikke.
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

  protected readonly tabBarItems = TAB_BAR_ITEMS;

  private readonly tabBarHidden = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => this.deepestRouteHidesTabBar()),
    ),
    { initialValue: this.deepestRouteHidesTabBar() },
  );

  protected readonly showTabBar = computed(() => !this.tabBarHidden());

  private deepestRouteHidesTabBar(): boolean {
    let deepest: ActivatedRouteSnapshot = this.route.snapshot;
    while (deepest.firstChild) {
      deepest = deepest.firstChild;
    }
    return deepest.data[ROUTE_DATA.HIDE_TAB_BAR] === true;
  }
}
