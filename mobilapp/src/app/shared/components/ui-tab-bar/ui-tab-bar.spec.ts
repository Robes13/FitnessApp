import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { APP_PATH, APP_ROUTE, ROUTE_PARAM } from '../../../core/constants/app-route';
import { TabBarItem, UiTabBar } from './ui-tab-bar';

const ITEMS: readonly TabBarItem[] = [
  { label: 'Mad', icon: 'tab-food', path: APP_PATH.FOOD },
  { label: 'Vægt', icon: 'tab-weight', path: APP_PATH.WEIGHT },
  { label: 'Hjem', icon: 'tab-home', path: APP_PATH.HOME },
  { label: 'Samling', icon: 'tab-collections', path: APP_PATH.COLLECTIONS },
  { label: 'Historik', icon: 'tab-history', path: APP_PATH.HISTORY },
];

@Component({ template: '' })
class Blank {}

@Component({
  imports: [UiTabBar],
  template: `<app-ui-tab-bar [items]="items" />`,
})
class Host {
  readonly items = ITEMS;
}

describe('UiTabBar', () => {
  async function setup(initialUrl: string) {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([
          { path: APP_ROUTE.FOOD, component: Blank },
          { path: APP_ROUTE.WEIGHT, component: Blank },
          { path: APP_ROUTE.HOME, component: Blank },
          { path: APP_ROUTE.COLLECTIONS, component: Blank },
          { path: `${APP_ROUTE.COLLECTIONS}/:${ROUTE_PARAM.RECIPE_ID}`, component: Blank },
          { path: APP_ROUTE.HISTORY, component: Blank },
          { path: APP_ROUTE.PROFILE, component: Blank },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(initialUrl);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const bar = fixture.nativeElement.querySelector('app-ui-tab-bar') as HTMLElement;
    const component = fixture.debugElement.children[0]?.componentInstance as UiTabBar;
    return { fixture, router, bar, component };
  }

  it('renders one link per item and marks the current route active', async () => {
    const { bar, component } = await setup(APP_PATH.HOME);
    const links = Array.from(bar.querySelectorAll<HTMLAnchorElement>('a'));

    expect(bar.getAttribute('role')).toBe('navigation');
    expect(bar.getAttribute('aria-label')).toBe('Hovednavigation');
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Mad',
      'Vægt',
      'Hjem',
      'Samling',
      'Historik',
    ]);
    expect(component.activeIndex()).toBe(2);
    expect(bar.style.getPropertyValue('--tab-count')).toBe('5');
    expect(bar.style.getPropertyValue('--tab-index')).toBe('2');
  });

  it('moves the pill when the router navigates', async () => {
    const { fixture, router, bar, component } = await setup(APP_PATH.HOME);

    await router.navigateByUrl(APP_PATH.HISTORY);
    await fixture.whenStable();

    expect(component.activeIndex()).toBe(4);
    expect(bar.style.getPropertyValue('--tab-index')).toBe('4');
  });

  it('treats child routes as part of their tab', async () => {
    const { component } = await setup(APP_PATH.recipe('demo-skyr-bowl'));
    expect(component.activeIndex()).toBe(3);
  });

  it('hides the pill when no tab matches', async () => {
    const { bar, component } = await setup(APP_PATH.PROFILE);
    const pill = bar.querySelector('.ui-tab-bar__pill') as HTMLElement;

    expect(component.activeIndex()).toBe(-1);
    expect(pill.classList.contains('ui-tab-bar__pill--hidden')).toBe(true);
  });
});
