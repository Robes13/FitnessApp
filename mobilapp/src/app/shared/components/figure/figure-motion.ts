import {
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Signal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FigureGeometry } from './figure-geometry';
import { clamp } from '../../../core/utils/math';

const NUMBER = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;
const MOTION_TOKEN = '--duration-fast';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Paths retain their commands; every coordinate uses the same interpolation fraction. */
function blendPath(from: string, to: string, fraction: number): string {
  const start = from.match(NUMBER)?.map(Number) ?? [];
  const end = to.match(NUMBER) ?? [];
  if (start.length !== end.length || from.replace(NUMBER, '#') !== to.replace(NUMBER, '#')) {
    return to;
  }
  let index = 0;
  return to.replace(NUMBER, (value) => {
    const initial = start[index++]!;
    return String(initial + (Number(value) - initial) * fraction);
  });
}

export function interpolateFigure(
  from: FigureGeometry,
  to: FigureGeometry,
  fraction: number,
): FigureGeometry {
  if (fraction >= 1) return to;
  return Object.fromEntries(
    Object.entries(to).map(([key, value]) => {
      const initial = from[key as keyof FigureGeometry];
      return [
        key,
        typeof value === 'number' && typeof initial === 'number'
          ? initial + (value - initial) * fraction
          : blendPath(String(initial), String(value), fraction),
      ];
    }),
  ) as unknown as FigureGeometry;
}

/** One interruptible clock for the entire scene, including props derived from geometry. */
export function animatedFigure(
  factory: () => FigureGeometry,
  enabled: () => boolean = () => true,
): Signal<FigureGeometry> {
  const target = computed(factory);
  const visible = signal<FigureGeometry | null>(null);
  const view = inject(DOCUMENT).defaultView;
  const host = inject(ElementRef<HTMLElement>).nativeElement;
  const destroy = inject(DestroyRef);
  const preference = view?.matchMedia?.(REDUCED_MOTION);
  const reduced = signal(preference?.matches ?? true);
  let frame: number | null = null;
  const cancel = (): void => {
    if (frame !== null) view?.cancelAnimationFrame(frame);
    frame = null;
  };
  const preferenceChanged = (): void => reduced.set(preference?.matches ?? true);
  preference?.addEventListener('change', preferenceChanged);
  effect(() => {
    const next = target();
    const animate = enabled() && !reduced();
    const previous = untracked(visible);
    cancel();
    const token = view?.getComputedStyle(host).getPropertyValue(MOTION_TOKEN).trim() ?? '';
    const duration = parseFloat(token) * (token.endsWith('ms') ? 1 : 1000);
    if (!view || !animate || !previous || !(duration > 0)) {
      visible.set(next);
      return;
    }
    const start = view.performance.now();
    const tick = (now: number): void => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      visible.set(interpolateFigure(previous, next, eased));
      frame = progress < 1 ? view.requestAnimationFrame(tick) : null;
    };
    frame = view.requestAnimationFrame(tick);
  });
  destroy.onDestroy(() => {
    cancel();
    preference?.removeEventListener('change', preferenceChanged);
  });
  return computed(() => visible() ?? target());
}
