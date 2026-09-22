import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WeightScaleScene } from './weight-scale-scene';

@Component({
  imports: [WeightScaleScene],
  template: `
    <app-weight-scale-scene
      [weightKg]="weightKg()"
      [heightCm]="178"
      [progressKg]="progressKg()"
      [saved]="saved()"
      [lookDirection]="lookDirection()"
    />
  `,
})
class Host {
  readonly weightKg = signal(75);
  readonly progressKg = signal(0);
  readonly saved = signal(false);
  readonly lookDirection = signal(0);
}

describe('WeightScaleScene', () => {
  async function setup() {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, root };
  }

  it('tegner badevægten med figuren og vægten på displayet', async () => {
    const { root } = await setup();

    expect(root.querySelector('svg')?.getAttribute('aria-label')).toBe('Figur på vægt');
    expect(root.querySelector('g[app-figure-body]')).not.toBeNull();
    expect(root.querySelector('.weight-scale-scene__readout')?.textContent?.trim()).toBe('75,0');
    expect(root.querySelectorAll('.weight-scale-scene__sweat')).toHaveLength(0);
    expect(root.querySelectorAll('.weight-scale-scene__spark')).toHaveLength(0);
  });

  it('sveder og damper, når fremgangen vokser', async () => {
    const { fixture, host, root } = await setup();

    host.progressKg.set(2.5);
    await fixture.whenStable();

    expect(root.querySelectorAll('.weight-scale-scene__sweat')).toHaveLength(10);
    expect(root.querySelectorAll('.weight-scale-scene__steam')).toHaveLength(3);
    expect(
      root
        .querySelector('.figure-body__band')
        ?.classList.contains('figure-body__band--accent-deep'),
    ).toBe(true);
  });

  it('hopper og gnistrer, når vejningen er gemt', async () => {
    const { fixture, host, root } = await setup();

    host.saved.set(true);
    await fixture.whenStable();

    expect(root.querySelector('.weight-scale-scene__figure')?.getAttribute('transform')).toBe(
      'translate(0 -34)',
    );
    expect(root.querySelectorAll('.weight-scale-scene__spark')).toHaveLength(5);
  });

  it('lader pupillerne følge retningen, vægten ændres i', async () => {
    const { fixture, host, root } = await setup();
    const pupilX = () => root.querySelector('.figure-body__pupil')?.getAttribute('cx');
    const neutral = pupilX();

    host.lookDirection.set(1);
    await fixture.whenStable();
    const right = pupilX();

    host.lookDirection.set(-1);
    await fixture.whenStable();

    expect(right).not.toBe(neutral);
    expect(pupilX()).not.toBe(right);
  });
});
