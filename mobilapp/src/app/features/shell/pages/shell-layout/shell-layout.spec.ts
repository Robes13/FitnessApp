import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { APP_PATH, APP_ROUTE } from '../../../../core/constants/app-route';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { ShellLayout } from './shell-layout';

@Component({ template: '' })
class Blank {}

const ROUTES: Routes = [
  {
    path: APP_ROUTE.ROOT,
    component: ShellLayout,
    children: [{ path: APP_ROUTE.HOME, component: Blank }],
  },
];

describe('ShellLayout', () => {
  const keyboardOpen = signal(false);

  beforeEach(() => keyboardOpen.set(false));

  async function setup(initialUrl: string) {
    const keyboard: Pick<KeyboardService, 'isOpen'> = { isOpen: keyboardOpen.asReadonly() };
    TestBed.configureTestingModule({
      providers: [provideRouter(ROUTES), { provide: KeyboardService, useValue: keyboard }],
    });
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

  it('hides the tab bar while the on-screen keyboard is open', async () => {
    const { harness, shell } = await setup(APP_PATH.HOME);

    keyboardOpen.set(true);
    await harness.fixture.whenStable();
    expect(tabBar(shell)).toBeNull();

    keyboardOpen.set(false);
    await harness.fixture.whenStable();
    expect(tabBar(shell)).not.toBeNull();
  });
});
