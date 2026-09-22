import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  RULER_BLEED_DRAGGING,
  RULER_BLEED_IDLE,
  RULER_DEFAULT_GLOW_REACH,
  RulerGeometryOptions,
  computeRulerGeometry,
  formatRulerLabel,
} from './ruler-geometry';
import { UiRuler } from './ui-ruler';

/** The design's `ruler(30, 300, val)`: 1 kg per tick, 8 px per tick, major every 10th, label every 10th. */
const WEIGHT_RULER: Omit<RulerGeometryOptions, 'value' | 'bleed'> = {
  min: 30,
  max: 300,
  tickUnit: 1,
  pxPerTick: 8,
  majorEvery: 10,
  midEvery: 5,
  labelEvery: 10,
  reach: RULER_DEFAULT_GLOW_REACH,
  labelFormatter: formatRulerLabel,
};

/**
 * Expected values were computed by running the design's original `ruler()` / `stepRuler()` from
 * `logic.js` in node. Colors are translated: `#F97316` → current, `#cbd5e1` → major without glow,
 * `#475569` → minor without glow, `rgba(249,115,22,α)` → glowPercent = α × 100.
 */
describe('computeRulerGeometry', () => {
  it('matcher designets ruler(30, 300, 75) i hvile', () => {
    const geometry = computeRulerGeometry({ ...WEIGHT_RULER, value: 75, bleed: RULER_BLEED_IDLE });

    expect(geometry.ticks).toHaveLength(271);
    expect(geometry.labels).toHaveLength(28);
    expect(geometry.offset).toBe(-360);
    expect(geometry.ticks[0]).toEqual({ x: 0, height: 28, kind: 'major', glowPercent: null });
    expect(geometry.ticks[44]).toEqual({ x: 352, height: 13, kind: 'minor', glowPercent: 50 });
    expect(geometry.ticks[45]).toEqual({ x: 360, height: 37, kind: 'current', glowPercent: null });
    expect(geometry.ticks[46]).toEqual({ x: 368, height: 13, kind: 'minor', glowPercent: 50 });
    expect(geometry.ticks[47]).toEqual({ x: 376, height: 12, kind: 'minor', glowPercent: 46 });
    expect(geometry.ticks[48]).toEqual({ x: 384, height: 12, kind: 'minor', glowPercent: 42 });
    expect(geometry.ticks[49]).toEqual({ x: 392, height: 11, kind: 'minor', glowPercent: 38 });
    expect(geometry.ticks[50]).toEqual({ x: 400, height: 29, kind: 'major', glowPercent: null });
    expect(geometry.ticks[51]).toEqual({ x: 408, height: 10, kind: 'minor', glowPercent: null });
    expect(geometry.ticks[55]).toEqual({ x: 440, height: 18, kind: 'minor', glowPercent: null });
    expect(geometry.ticks[270]).toEqual({ x: 2160, height: 28, kind: 'major', glowPercent: null });
    expect(geometry.labels.slice(0, 4)).toEqual([
      { x: 0, text: '30' },
      { x: 80, text: '40' },
      { x: 160, text: '50' },
      { x: 240, text: '60' },
    ]);
  });

  it('gløder kraftigere og bredere under træk (bleed 1)', () => {
    const geometry = computeRulerGeometry({
      ...WEIGHT_RULER,
      value: 75,
      bleed: RULER_BLEED_DRAGGING,
    });

    expect(geometry.offset).toBe(-360);
    expect(geometry.ticks[40]).toEqual({ x: 320, height: 29, kind: 'major', glowPercent: 42 });
    expect(geometry.ticks[42]).toEqual({ x: 336, height: 15, kind: 'minor', glowPercent: 65 });
    expect(geometry.ticks[44]).toEqual({ x: 352, height: 18, kind: 'minor', glowPercent: 88 });
    expect(geometry.ticks[45]).toEqual({ x: 360, height: 43, kind: 'current', glowPercent: null });
    expect(geometry.ticks[46]).toEqual({ x: 368, height: 18, kind: 'minor', glowPercent: 88 });
    expect(geometry.ticks[49]).toEqual({ x: 392, height: 13, kind: 'minor', glowPercent: 53 });
    expect(geometry.ticks[50]).toEqual({ x: 400, height: 29, kind: 'major', glowPercent: 42 });
  });

  it('håndterer decimalværdier som vægt-sidens 75,4 kg', () => {
    const geometry = computeRulerGeometry({
      ...WEIGHT_RULER,
      value: 75.4,
      bleed: RULER_BLEED_IDLE,
    });

    expect(geometry.offset).toBe(-363.2);
    expect(geometry.ticks[44]).toEqual({ x: 352, height: 12, kind: 'minor', glowPercent: 49 });
    expect(geometry.ticks[45]).toEqual({ x: 360, height: 37, kind: 'current', glowPercent: null });
    expect(geometry.ticks[46]).toEqual({ x: 368, height: 13, kind: 'minor', glowPercent: 52 });
  });

  it('matcher designets stepRuler(6000) med 100 skridt pr. streg', () => {
    const geometry = computeRulerGeometry({
      min: 0,
      max: 50000,
      value: 6000,
      tickUnit: 100,
      pxPerTick: 5.6,
      majorEvery: 10,
      midEvery: 5,
      labelEvery: 20,
      bleed: RULER_BLEED_IDLE,
      reach: 8,
      labelFormatter: (steps) => (steps === 0 ? '0' : `${steps / 1000}k`),
    });

    expect(geometry.ticks).toHaveLength(501);
    expect(geometry.labels).toHaveLength(26);
    expect(geometry.offset).toBe(-336);
    expect(geometry.ticks[0]).toEqual({ x: 0, height: 28, kind: 'major', glowPercent: null });
    expect(geometry.ticks[55]).toEqual({ x: 308, height: 19, kind: 'minor', glowPercent: 39 });
    expect(geometry.ticks[58]).toEqual({ x: 324.8, height: 12, kind: 'minor', glowPercent: 48 });
    expect(geometry.ticks[59]).toEqual({ x: 330.4, height: 13, kind: 'minor', glowPercent: 51 });
    expect(geometry.ticks[60]).toEqual({ x: 336, height: 37, kind: 'current', glowPercent: null });
    expect(geometry.ticks[61]).toEqual({ x: 341.6, height: 13, kind: 'minor', glowPercent: 51 });
    expect(geometry.ticks[65]).toEqual({ x: 364, height: 19, kind: 'minor', glowPercent: 39 });
    expect(geometry.ticks[500]).toEqual({ x: 2800, height: 28, kind: 'major', glowPercent: null });
    expect(geometry.labels.slice(0, 5)).toEqual([
      { x: 0, text: '0' },
      { x: 112, text: '2k' },
      { x: 224, text: '4k' },
      { x: 336, text: '6k' },
      { x: 448, text: '8k' },
    ]);
    expect(geometry.labels[25]).toEqual({ x: 2800, text: '50k' });
  });

  it('starter store streger og etiketter ved absolutte værdier, ikke ved min', () => {
    const geometry = computeRulerGeometry({
      ...WEIGHT_RULER,
      min: 35,
      max: 74,
      value: 50,
      bleed: RULER_BLEED_IDLE,
    });

    expect(geometry.ticks[0]?.kind).toBe('minor');
    expect(geometry.ticks[5]?.kind).toBe('major');
    expect(geometry.labels[0]).toEqual({ x: 40, text: '40' });
  });

  it('giver tom geometri ved ugyldige mål', () => {
    const invalid = computeRulerGeometry({
      ...WEIGHT_RULER,
      tickUnit: 0,
      value: 75,
      bleed: RULER_BLEED_IDLE,
    });
    expect(invalid.ticks).toEqual([]);
    expect(invalid.labels).toEqual([]);
    expect(invalid.offset).toBe(0);
  });
});

@Component({
  imports: [UiRuler],
  template: `
    <app-ui-ruler
      [min]="min()"
      [max]="max()"
      [(value)]="value"
      [step]="step()"
      [(dragging)]="dragging"
      ariaLabel="Vægt i kilo"
    />
  `,
})
class Host {
  readonly min = signal(30);
  readonly max = signal(300);
  readonly value = signal(75);
  readonly step = signal(1);
  readonly dragging = signal(false);
}

function pointerEvent(type: string, clientX: number): Event {
  const Ctor = globalThis.PointerEvent ?? MouseEvent;
  return new Ctor(type, { clientX, bubbles: true });
}

describe('UiRuler', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const ruler = fixture.nativeElement.querySelector('app-ui-ruler') as HTMLElement;
    const range = ruler.querySelector('.ui-ruler__range') as HTMLElement;
    return { fixture, host, ruler, range };
  }

  it('renderer designets geometri og slider-semantik', async () => {
    const { ruler, range } = await setup();

    expect(range.getAttribute('role')).toBe('slider');
    expect(range.getAttribute('tabindex')).toBe('0');
    expect(range.getAttribute('aria-label')).toBe('Vægt i kilo');
    expect(range.getAttribute('aria-valuemin')).toBe('30');
    expect(range.getAttribute('aria-valuemax')).toBe('300');
    expect(range.getAttribute('aria-valuenow')).toBe('75');

    expect(ruler.classList.contains('ui-ruler--md')).toBe(true);
    expect(ruler.style.getPropertyValue('--ruler-offset')).toBe('-360px');

    const ticks = ruler.querySelectorAll<HTMLElement>('.ui-ruler__tick');
    expect(ticks).toHaveLength(271);
    const current = ruler.querySelector('.ui-ruler__tick--current') as HTMLElement;
    expect(current.style.left).toBe('360px');
    expect(current.style.height).toBe('37px');
    const glowing = ticks[44] as HTMLElement;
    expect(glowing.classList.contains('ui-ruler__tick--glow')).toBe(true);
    expect(glowing.style.getPropertyValue('--ruler-tick-glow')).toBe('50%');
    expect((ticks[51] as HTMLElement).style.getPropertyValue('--ruler-tick-glow')).toBe('');

    const labels = ruler.querySelectorAll<HTMLElement>('.ui-ruler__label');
    expect(labels).toHaveLength(28);
    expect(labels[0]?.textContent?.trim()).toBe('30');
    expect(labels[1]?.style.left).toBe('80px');
  });

  it('flytter værdien med piletaster i step-trin og klemmer fast til min/max', async () => {
    const { fixture, host, range } = await setup();

    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(host.value()).toBe(76);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(host.value()).toBe(74);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(host.value()).toBe(300);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(host.value()).toBe(300);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(host.value()).toBe(30);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(host.value()).toBe(30);

    host.step.set(5);
    await fixture.whenStable();
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(host.value()).toBe(35);

    await fixture.whenStable();
    expect(range.getAttribute('aria-valuenow')).toBe('35');
  });

  it('runder decimaltrin uden flydende-tal-støj', async () => {
    const { fixture, host, range } = await setup();
    host.step.set(0.1);
    await fixture.whenStable();

    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(host.value()).toBe(75.1);
    range.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(host.value()).toBe(75.2);
  });

  it('committer værdien under fingeren ved nedtryk og følger trækket', async () => {
    const { fixture, host, ruler, range } = await setup();

    // In jsdom the element's rect is 0×0 at x = 0, so the center is 0 and 16 px equals +2 kg (8 px/kg).
    range.dispatchEvent(pointerEvent('pointerdown', 16));
    expect(host.value()).toBe(77);
    expect(host.dragging()).toBe(true);
    await fixture.whenStable();
    expect(ruler.classList.contains('ui-ruler--dragging')).toBe(true);

    range.dispatchEvent(pointerEvent('pointermove', 24));
    expect(host.value()).toBe(78);

    range.dispatchEvent(pointerEvent('pointerup', 24));
    expect(host.dragging()).toBe(false);
    expect(host.value()).toBe(78);

    range.dispatchEvent(pointerEvent('pointermove', 400));
    expect(host.value()).toBe(78);
    await fixture.whenStable();
    expect(ruler.classList.contains('ui-ruler--dragging')).toBe(false);
  });

  it('klemmer træk fast til max', async () => {
    const { host, range } = await setup();

    range.dispatchEvent(pointerEvent('pointerdown', 8000));
    expect(host.value()).toBe(300);
    range.dispatchEvent(pointerEvent('pointercancel', 8000));
    expect(host.dragging()).toBe(false);
  });
});
