import { Directive, ElementRef, afterRenderEffect, inject, input } from '@angular/core';

const MILLISECONDS_PER_SECOND = 1000;

/** Change a looping animation's speed without jumping to another point in its cycle. */
@Directive({ selector: '[appFigureTempo]' })
export class FigureTempo {
  readonly appFigureTempo = input.required<number>();
  private readonly element = inject(ElementRef<SVGElement>).nativeElement;

  constructor() {
    afterRenderEffect(() => {
      const seconds = this.appFigureTempo();
      if (!(seconds > 0)) return;
      if (!this.element.getAnimations) {
        this.element.style.animationDuration = `${seconds}s`;
        return;
      }
      // Keep CSS duration fixed; playback rate preserves the current animation phase.
      this.element.style.animationDuration = '1s';
      for (const animation of this.element.getAnimations?.() ?? []) {
        const duration = animation.effect?.getTiming().duration;
        if (typeof duration === 'number' && duration > 0) {
          animation.updatePlaybackRate(duration / (seconds * MILLISECONDS_PER_SECOND));
        }
      }
    });
  }
}
