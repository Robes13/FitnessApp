import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { KEYBOARD_CSS } from '../../constants/keyboard';
import { KeyboardPlatform, KeyboardUnsubscribe } from '../../models/keyboard';
import { KeyboardService } from './keyboard';
import { KEYBOARD_PLATFORM } from './keyboard-platform';

/** Stand-in for the native keyboard plugin; `show()`/`hide()` fire its events. */
class FakeKeyboard implements KeyboardPlatform {
  available = true;
  overlays = true;
  private willShow: ((heightPx: number) => void) | null = null;
  private didShow: (() => void) | null = null;
  private willHide: (() => void) | null = null;

  isAvailable(): boolean {
    return this.available;
  }

  overlaysContent(): boolean {
    return this.overlays;
  }

  onWillShow(listener: (heightPx: number) => void): KeyboardUnsubscribe {
    this.willShow = listener;
    return () => (this.willShow = null);
  }

  onDidShow(listener: () => void): KeyboardUnsubscribe {
    this.didShow = listener;
    return () => (this.didShow = null);
  }

  onWillHide(listener: () => void): KeyboardUnsubscribe {
    this.willHide = listener;
    return () => (this.willHide = null);
  }

  show(heightPx: number): void {
    this.willShow?.(heightPx);
    this.didShow?.();
  }

  hide(): void {
    this.willHide?.();
  }
}

describe('KeyboardService', () => {
  function setup(configure: (fake: FakeKeyboard) => void = () => undefined) {
    const fake = new FakeKeyboard();
    configure(fake);
    TestBed.configureTestingModule({ providers: [{ provide: KEYBOARD_PLATFORM, useValue: fake }] });
    const keyboard = TestBed.inject(KeyboardService);
    const root = TestBed.inject(DOCUMENT).documentElement;
    return { fake, keyboard, root };
  }

  afterEach(() => {
    const root = document.documentElement;
    root.style.removeProperty(KEYBOARD_CSS.INSET_VARIABLE);
    root.removeAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE);
  });

  it('writes the keyboard height and open state to <html> while it is shown', () => {
    const { fake, keyboard, root } = setup();

    fake.show(336);

    expect(keyboard.isOpen()).toBe(true);
    expect(keyboard.inset()).toBe(336);
    expect(root.style.getPropertyValue(KEYBOARD_CSS.INSET_VARIABLE)).toBe('336px');
    expect(root.getAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE)).toBe(KEYBOARD_CSS.OPEN);

    fake.hide();

    expect(keyboard.isOpen()).toBe(false);
    expect(root.style.getPropertyValue(KEYBOARD_CSS.INSET_VARIABLE)).toBe('0px');
    expect(root.hasAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE)).toBe(false);
  });

  it('keeps the inset at 0 where the system already resizes the WebView (Android)', () => {
    const { fake, keyboard, root } = setup((platform) => (platform.overlays = false));

    fake.show(300);

    expect(keyboard.isOpen()).toBe(true);
    expect(keyboard.inset()).toBe(0);
    expect(root.style.getPropertyValue(KEYBOARD_CSS.INSET_VARIABLE)).toBe('0px');
  });

  it('scrolls the focused field into view within its own scroll area once shown', () => {
    const { fake } = setup();
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const scrollIntoView = vi.fn();
    input.scrollIntoView = scrollIntoView;

    fake.show(336);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    input.remove();
  });

  it('does nothing in the browser, where there is no keyboard plugin', () => {
    const { keyboard, root } = setup((platform) => (platform.available = false));

    expect(keyboard.isOpen()).toBe(false);
    expect(root.hasAttribute(KEYBOARD_CSS.STATE_ATTRIBUTE)).toBe(false);
  });

  it('closes the keyboard on a tap in the app outside a text field, but not on a field', () => {
    const { fake, keyboard } = setup();
    const root = document.createElement('div');
    const input = document.createElement('input');
    const button = document.createElement('button');
    root.append(input, button);
    document.body.append(root);
    keyboard.closeOnTapsIn(root);
    input.scrollIntoView = vi.fn();
    input.focus();
    fake.show(336);

    input.click();
    expect(document.activeElement).toBe(input);

    button.click();
    expect(document.activeElement).not.toBe(input);

    root.remove();
  });

  it('waits for the click, so the press never moves the layout under the finger', () => {
    const { fake, keyboard } = setup();
    const root = document.createElement('div');
    const input = document.createElement('input');
    const button = document.createElement('button');
    root.append(input, button);
    document.body.append(root);
    keyboard.closeOnTapsIn(root);
    input.scrollIntoView = vi.fn();
    input.focus();
    fake.show(336);

    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.activeElement).toBe(input);

    button.click();
    expect(document.activeElement).not.toBe(input);

    root.remove();
  });
});
