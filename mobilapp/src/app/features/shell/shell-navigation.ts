import { APP_PATH } from '../../core/constants/app-route';
import { TabBarItem } from '../../shared/components/ui-tab-bar/ui-tab-bar';

/** A tab with a translation key instead of its text – `ShellLayout` translates it. */
export interface ShellTabDefinition extends Omit<TabBarItem, 'label'> {
  readonly labelKey: string;
}

/** The five tabs in the design's order (`tabDefs`). Profile is reached via the avatar on Home. */
export const TAB_BAR_ITEMS: readonly ShellTabDefinition[] = [
  { labelKey: 'shell.tabBar.food', icon: 'tab-food', path: APP_PATH.FOOD },
  { labelKey: 'shell.tabBar.weight', icon: 'tab-weight', path: APP_PATH.WEIGHT },
  { labelKey: 'shell.tabBar.home', icon: 'tab-home', path: APP_PATH.HOME },
  { labelKey: 'shell.tabBar.collections', icon: 'tab-collections', path: APP_PATH.COLLECTIONS },
  { labelKey: 'shell.tabBar.history', icon: 'tab-history', path: APP_PATH.HISTORY },
];
