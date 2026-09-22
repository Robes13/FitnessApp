import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Figure } from './figure';

@Component({
  imports: [Figure],
  template: `
    <app-figure
      [weightKg]="weightKg()"
      [heightCm]="heightCm()"
      [mood]="mood()"
      [showCeiling]="showCeiling()"
      showDumbbell
    />
  `,
})
class Host {
  readonly weightKg = signal(75);
  readonly heightCm = signal(178);
  readonly mood = signal(0);
  readonly showCeiling = signal(false);
}

describe('Figure', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const svg = root.querySelector('svg') as SVGSVGElement;
    return { fixture, host: fixture.componentInstance, root, svg };
  }

  it('tegner en bundjusteret SVG med figurens krop og designets aria-label', async () => {
    const { svg } = await setup();

    expect(svg.getAttribute('viewBox')).toBe('0 0 200 300');
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMax meet');
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Figur');
    expect(svg.querySelector('g[app-figure-body]')).not.toBeNull();
    expect(svg.querySelector('.figure-body__body')?.getAttribute('width')).toBe('60');
    expect(svg.querySelectorAll('.figure-body__dumbbell-cap')).toHaveLength(2);
    expect(svg.querySelector('.figure__ceiling')).toBeNull();
  });

  it('viser loft og lampe usynligt under 212 cm og fader dem ind over', async () => {
    const { fixture, host, svg } = await setup();

    host.showCeiling.set(true);
    await fixture.whenStable();

    const ceiling = svg.querySelector('.figure__ceiling') as SVGElement;
    const lamp = svg.querySelector('.figure__lamp') as SVGElement;
    expect(ceiling.style.opacity).toBe('0');
    expect(lamp.getAttribute('d')).toBe('M124 106 L156 106 L150 122 L130 122 Z');
    expect(lamp.getAttribute('transform')).toBe('rotate(0 140 92)');

    host.heightCm.set(250);
    await fixture.whenStable();

    expect(ceiling.style.opacity).toBe('1');
    expect(lamp.getAttribute('transform')).toBe('rotate(-28 140 92)');
    expect(svg.querySelector('.figure-body__head')?.getAttribute('transform')).toBe(
      'rotate(-26 100 116.2)',
    );
  });

  it('lader humøret styre smilet', async () => {
    const { fixture, host, svg } = await setup();

    host.mood.set(1);
    await fixture.whenStable();
    expect(svg.querySelector('.figure-body__smile')?.getAttribute('d')).toBe(
      'M91 161 Q100 174 109 161',
    );

    host.mood.set(-1);
    await fixture.whenStable();
    expect(svg.querySelector('.figure-body__smile')?.getAttribute('d')).toBe(
      'M91 167 Q100 158 109 167',
    );
  });
});
