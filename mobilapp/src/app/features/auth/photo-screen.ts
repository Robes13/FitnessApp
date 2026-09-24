import { DestroyRef, inject } from '@angular/core';
import { ThemeService } from '../../core/services/theme/theme';

/**
 * Call from a photo screen's constructor: keeps the system bars' icons light while the screen is
 * open, because its photo is dark in both themes. The screen binds `data-theme` to
 * `PHOTO_SCREEN_THEME` on its host, so its own colours stay dark as well.
 */
export function holdDarkSystemBarsWhileOpen(): void {
  const release = inject(ThemeService).holdDarkSystemBars();
  inject(DestroyRef).onDestroy(release);
}
