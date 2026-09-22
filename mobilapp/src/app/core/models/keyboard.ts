/** Stops listening to a keyboard event. */
export type KeyboardUnsubscribe = () => void;

/**
 * The on-screen keyboard behind an interface, so specs can give a fake. Heights are CSS
 * pixels.
 */
export interface KeyboardPlatform {
  /** False in the browser, where there is no native keyboard plugin. */
  isAvailable(): boolean;
  /**
   * True when the keyboard is drawn *over* the WebView without resizing it (iOS with
   * `resize: 'none'`), so the app must shrink its own layout. False when the platform
   * already resizes the WebView (Android's `adjustResize`).
   */
  overlaysContent(): boolean;
  onWillShow(listener: (heightPx: number) => void): KeyboardUnsubscribe;
  onDidShow(listener: () => void): KeyboardUnsubscribe;
  onWillHide(listener: () => void): KeyboardUnsubscribe;
}
