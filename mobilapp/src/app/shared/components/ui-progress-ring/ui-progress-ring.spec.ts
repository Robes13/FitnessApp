import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UiProgressRing } from './ui-progress-ring';

@Component({
  imports: [UiProgressRing],
  template: `
    <app-ui-progress-ring
      [value]="value()"
      [diameter]="diameter()"
      [strokeWidth]="strokeWidth()"
      [trackTone]="trackTone()"
      tone="positive"
    >
      <span class="center">3</span>
    </app-ui-progress-ring>
  `,
})
class Host {
  readonly value = signal(0.25);
  readonly diameter = signal(48);
  readonly strokeWidth = signal(4);
  readonly trackTone = signal<'line' | 'neutral' | 'none'>('line');
}

describe('UiProgressRing', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const host = fixture.nativeElement.querySelector('app-ui-progress-ring') as HTMLElement;
    const ring = fixture.debugElement.query((el) => el.componentInstance instanceof UiProgressRing)
      .componentInstance as UiProgressRing;
    return { fixture, host, ring };
  }

  it('computes radius, circumference and dashoffset from diameter and stroke width', async () => {
    const { ring } = await setup();

    // 48 px ring, 4 px stroke → r = 22, C = 2π·22
    expect(ring.radius()).toBe(22);
    expect(ring.circumference()).toBeCloseTo(2 * Math.PI * 22, 6);
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference() * 0.75, 6);
    expect(ring.percent()).toBe(25);
  });

  it('matches the dash lengths used in the design', async () => {
    const { fixture, ring } = await setup();
    const host = fixture.componentInstance;

    // The design's hand-written dasharrays come from diameter = 2·r + strokeWidth.
    const cases: readonly [number, number, number][] = [
      [45, 3, 132], // signup step ring: r 21 in a 48 box
      [36, 4, 100.5], // home week rings: r 16 in a 40 box
      [94, 10, 264], // food kcal ring: r 42 in a 100 viewBox
      [55, 3, 163.4], // achievement badge arc: r 26 in a 56 box
    ];
    for (const [diameter, strokeWidth, expected] of cases) {
      host.diameter.set(diameter);
      host.strokeWidth.set(strokeWidth);
      await fixture.whenStable();
      expect(ring.circumference()).toBeCloseTo(expected, 0);
    }
  });

  it('clamps the value so the offset stays within 0..circumference', async () => {
    const { fixture, ring } = await setup();
    const host = fixture.componentInstance;

    host.value.set(4);
    await fixture.whenStable();
    expect(ring.dashOffset()).toBe(0);
    expect(ring.percent()).toBe(100);

    host.value.set(-1);
    await fixture.whenStable();
    expect(ring.dashOffset()).toBeCloseTo(ring.circumference(), 6);
    expect(ring.percent()).toBe(0);
  });

  it('renders the SVG geometry, size variable and projected centre content', async () => {
    const { host } = await setup();
    const svg = host.querySelector('svg') as SVGElement;
    const circles = host.querySelectorAll('circle');
    const value = circles[1] as SVGCircleElement;

    expect(svg.getAttribute('viewBox')).toBe('0 0 48 48');
    expect(circles.length).toBe(2);
    expect(value.getAttribute('r')).toBe('22');
    expect(value.getAttribute('stroke-width')).toBe('4');
    expect(Number(value.getAttribute('stroke-dasharray'))).toBeCloseTo(2 * Math.PI * 22, 6);
    expect(Number(value.getAttribute('stroke-dashoffset'))).toBeCloseTo(2 * Math.PI * 22 * 0.75, 6);
    expect(value.classList.contains('ui-progress-ring__value--positive')).toBe(true);
    expect(value.classList.contains('ui-progress-ring__value--animated')).toBe(true);
    expect(host.style.getPropertyValue('--ring-size')).toBe('48px');
    expect(host.getAttribute('aria-valuenow')).toBe('25');
    expect(host.querySelector('.center')?.textContent).toBe('3');
  });

  it('omits the track when trackTone is none', async () => {
    const { fixture, host } = await setup();

    fixture.componentInstance.trackTone.set('none');
    await fixture.whenStable();

    expect(host.querySelectorAll('circle').length).toBe(1);
    expect(host.querySelector('.ui-progress-ring__track')).toBeNull();
  });
});
