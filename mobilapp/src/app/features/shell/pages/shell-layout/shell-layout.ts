import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeyboardService } from '../../../../core/services/keyboard/keyboard';
import { injectTranslate } from '../../../../core/services/language/translate';
import { TabBarItem, UiTabBar } from '../../../../shared/components/ui-tab-bar/ui-tab-bar';
import { TAB_BAR_ITEMS } from '../../shell-navigation';

/**
 * The frame around the tab screens: a `<router-outlet>` for the active page and the tab
 * bar at the bottom. Full screens without a tab bar (Profile, the recipe) sit outside the
 * shell in `app.routes.ts`.
 *
 * The tab bar is hidden while the on-screen keyboard is open – as in native iOS apps, the
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
  private readonly keyboard = inject(KeyboardService);
  private readonly t = injectTranslate();

  protected readonly tabBarItems = computed<readonly TabBarItem[]>(() =>
    TAB_BAR_ITEMS.map(({ labelKey, ...item }) => ({ ...item, label: this.t(labelKey) })),
  );

  protected readonly showTabBar = computed(() => !this.keyboard.isOpen());
}
