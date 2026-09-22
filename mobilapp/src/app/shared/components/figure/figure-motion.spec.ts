import { ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { computeFigureGeometry } from './figure-geometry';
import { animatedFigure, interpolateFigure } from './figure-motion';

describe('figure motion', () => {
  it('keeps the arm attached to its dumbbell throughout a large change', () => {
    const from = computeFigureGeometry(35, 120, -1);
    const to = computeFigureGeometry(280, 245, 1);
    for (const fraction of [0, 0.1, 0.5, 0.9, 1]) {
      const frame = interpolateFigure(from, to, fraction);
      const arm = frame.armR.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      expect(arm[4]! - frame.dbX).toBeCloseTo(20);
      expect(arm[5]! - frame.dbY).toBeCloseTo(3);
      expect(frame.headY - frame.bandY).toBeCloseTo(14);
      expect(frame.bodyW - frame.beltW).toBeCloseTo(-6);
    }
  });

  it('retargets from the visible frame, cancels old work and respects reduced motion', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    let id = 0;
    let now = 0;
    let preferenceListener: (() => void) | undefined;
    const preference = {
      matches: false,
      addEventListener: (_type: string, listener: () => void): void => {
        preferenceListener = listener;
      },
      removeEventListener: vi.fn(),
    };
    const element = document.createElement('div');
    element.style.setProperty('--duration-fast', '120ms');
    vi.stubGlobal('matchMedia', () => preference);
    vi.spyOn(window.performance, 'now').mockImplementation(() => now);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callbacks.set(++id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((key) => {
      callbacks.delete(key);
    });
    TestBed.configureTestingModule({
      providers: [{ provide: ElementRef, useValue: new ElementRef(element) }],
    });
    const target = signal(computeFigureGeometry(75, 178));
    const visible = TestBed.runInInjectionContext(() => animatedFigure(target));
    const tick = (time: number): void => {
      now = time;
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback(now));
    };
    try {
      TestBed.tick();
      target.set(computeFigureGeometry(300, 250, 1));
      TestBed.tick();
      tick(40);
      const beforeReverse = visible();
      target.set(computeFigureGeometry(30, 120, -1));
      TestBed.tick();
      expect(visible()).toEqual(beforeReverse);
      expect(callbacks.size).toBe(1);
      tick(80);
      expect(visible().bodyW).toBeLessThan(beforeReverse.bodyW);
      tick(160);
      expect(visible()).toEqual(target());
      expect(callbacks.size).toBe(0);
      target.set(computeFigureGeometry(200, 220));
      TestBed.tick();
      preference.matches = true;
      preferenceListener?.();
      TestBed.tick();
      expect(visible()).toEqual(target());
      expect(callbacks.size).toBe(0);
      TestBed.resetTestingModule();
      expect(preference.removeEventListener).toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
  });
});
