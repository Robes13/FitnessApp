import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE, ROUTE_PARAM } from '../../../../core/constants/app-route';
import { ROUTE_DATA } from '../../../../core/constants/route-data';
import { ShellLayout } from './shell-layout';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  {
    path: APP_ROUTE.ROOT,
    component: ShellLayout,
    children: [
      { path: APP_ROUTE.HOME, component: Blank },
      {
        path: APP_ROUTE.COLLECTIONS,
        children: [
          { path: APP_ROUTE.ROOT, component: Blank },
          {
            path: `:${ROUTE_PARAM.RECIPE_ID}`,
            component: Blank,
            data: { [ROUTE_DATA.HIDE_TAB_BAR]: true },
          },
        ],
      },
    ],
  },
];

describe('ShellLayout', () => {
  async function setup(initialUrl: string) {
    TestBed.configureTestingModule({ providers: [provideRouter(ROUTES)] });
    const harness = await RouterTestingHarness.create(initialUrl);
    const shell = harness.routeNativeElement as HTMLElement;
    return { harness, shell };
  }

  function tabBar(shell: HTMLElement): HTMLElement | null {
    return shell.querySelector('app-ui-tab-bar');
  }

  it('renders the outlet and the five tabs in design order', async () => {
    const { shell } = await setup(APP_PATH.HOME);
    const bar = tabBar(shell);
    const labels = Array.from(bar?.querySelectorAll('a') ?? []).map((a) => a.textContent?.trim());

    expect(shell.classList.contains('shell-layout')).toBe(true);
    expect(shell.querySelector('router-outlet')).not.toBeNull();
    expect(labels).toEqual(['Mad', 'Vægt', 'Hjem', 'Samling', 'Historik']);
  });

  it('hides the tab bar when the deepest route asks for it', async () => {
    const { shell } = await setup(APP_PATH.recipe('demo-skyr-bowl'));

    expect(tabBar(shell)).toBeNull();
  });

  it('shows the tab bar again when navigating back to a tab route', async () => {
    const { harness, shell } = await setup(APP_PATH.recipe('demo-skyr-bowl'));

    await harness.navigateByUrl(APP_PATH.COLLECTIONS);
    await harness.fixture.whenStable();
    expect(tabBar(shell)).not.toBeNull();

    await harness.navigateByUrl(APP_PATH.recipe('demo-skyr-bowl'));
    await harness.fixture.whenStable();
    expect(tabBar(shell)).toBeNull();
  });
});
