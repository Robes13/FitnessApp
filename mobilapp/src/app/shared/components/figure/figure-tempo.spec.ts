import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FigureTempo } from './figure-tempo';

@Component({ imports: [FigureTempo], template: '<svg><g [appFigureTempo]="duration()" /></svg>' })
class Host {
  readonly duration = signal(2);
}

describe('FigureTempo', () => {
  it('changes playback speed without replacing the animation or resetting its current time', async () => {
    const fixture = TestBed.createComponent(Host);
    const animation = {
      currentTime: 375,
      effect: { getTiming: () => ({ duration: 1000 }) },
      updatePlaybackRate: vi.fn(),
    };
    fixture.detectChanges();
    const element = (fixture.nativeElement as HTMLElement).querySelector('g')!;
    Object.defineProperty(element, 'getAnimations', { value: () => [animation] });
    fixture.componentInstance.duration.set(0.5);
    await fixture.whenStable();
    expect(animation.updatePlaybackRate).toHaveBeenLastCalledWith(2);
    fixture.componentInstance.duration.set(4);
    await fixture.whenStable();
    expect(animation.updatePlaybackRate).toHaveBeenLastCalledWith(0.25);
    expect(animation.currentTime).toBe(375);
    expect(element.style.animationDuration).toBe('1s');
  });
});
