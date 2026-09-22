import { APP_PATH } from '../../core/constants/app-route';
import { TabBarItem } from '../../shared/components/ui-tab-bar/ui-tab-bar';

/** The five tabs in the design's order (`tabDefs`). Profile is reached via the avatar on Home. */
export const TAB_BAR_ITEMS: readonly TabBarItem[] = [
  { label: 'Mad', icon: 'tab-food', path: APP_PATH.FOOD },
  { label: 'Vægt', icon: 'tab-weight', path: APP_PATH.WEIGHT },
  { label: 'Hjem', icon: 'tab-home', path: APP_PATH.HOME },
  { label: 'Samling', icon: 'tab-collections', path: APP_PATH.COLLECTIONS },
  { label: 'Historik', icon: 'tab-history', path: APP_PATH.HISTORY },
];
