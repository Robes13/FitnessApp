export type Theme = 'dark' | 'light';

/**
 * The native status and navigation bars behind an interface, so specs can give a fake. The
 * bars' icons must contrast with the app's own theme, not the OS's light/dark setting.
 */
export interface SystemBarsPlatform {
  /** Colours the bars' icons for an app drawn in `theme`. A no-op in the browser. */
  applyTheme(theme: Theme): void;
}
