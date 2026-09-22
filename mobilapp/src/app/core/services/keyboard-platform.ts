import { InjectionToken } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { KeyboardPlatform, KeyboardUnsubscribe } from '../models/keyboard';

/** The plugin's name in the native bridge (`Capacitor.isPluginAvailable`). */
const PLUGIN_NAME = 'Keyboard';
const PLATFORM_IOS = 'ios';

/** Adapts the plugin's promise-based listener handle to a plain unsubscribe function. */
function unsubscribeLater(handle: Promise<PluginListenerHandle>): KeyboardUnsubscribe {
  return () => {
    void handle.then((listener) => listener.remove());
  };
}

/** `@capacitor/keyboard` on iOS and Android. Unavailable in the browser. */
export class CapacitorKeyboardPlatform implements KeyboardPlatform {
  isAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable(PLUGIN_NAME);
  }

  overlaysContent(): boolean {
    return Capacitor.getPlatform() === PLATFORM_IOS;
  }

  onWillShow(listener: (heightPx: number) => void): KeyboardUnsubscribe {
    return unsubscribeLater(
      Keyboard.addListener('keyboardWillShow', (info) => listener(info.keyboardHeight)),
    );
  }

  onDidShow(listener: () => void): KeyboardUnsubscribe {
    return unsubscribeLater(Keyboard.addListener('keyboardDidShow', () => listener()));
  }

  onWillHide(listener: () => void): KeyboardUnsubscribe {
    return unsubscribeLater(Keyboard.addListener('keyboardWillHide', () => listener()));
  }
}

/** The platform's on-screen keyboard. Specs provide a fake. */
export const KEYBOARD_PLATFORM = new InjectionToken<KeyboardPlatform>('KEYBOARD_PLATFORM', {
  providedIn: 'root',
  factory: () => new CapacitorKeyboardPlatform(),
});
