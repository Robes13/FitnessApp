import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { SignupChapter } from '../../services/signup-state';

/** The design's `chapterLabel` when the user edits an answer from the summary. */
const EDITING_LABEL = 'Retter';
const EDITING_CAPTION = 'Tilbage til opsummering';

/** 48 px ring with a 3 px stroke – the design's progress ring in the signup header. */
const RING_DIAMETER = 48;
const RING_STROKE_WIDTH = 3;

/**
 * The progress at the top of the sign-up flow: a ring with the step number, chapter name +
 * "Trin x af y", and a bar per chapter whose width follows the number of visible steps.
 *
 * The component is pure presentation – the page supplies the derived values from
 * `SignupStateService`.
 */
@Component({
  selector: 'app-signup-progress',
  imports: [UiProgressRing],
  templateUrl: './signup-progress.html',
  styleUrl: './signup-progress.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'signup-progress' },
})
export class SignupProgress {
  readonly stepNumber = input.required<number>();
  readonly stepTotal = input.required<number>();
  /** Share 0..1 for the ring. */
  readonly value = input.required<number>();
  readonly chapters = input.required<readonly SignupChapter[]>();
  /** When the user edits an answer from the summary, the heading and subtext change. */
  readonly editing = input(false, { transform: booleanAttribute });

  protected readonly ringDiameter = RING_DIAMETER;
  protected readonly ringStrokeWidth = RING_STROKE_WIDTH;

  protected readonly chapterLabel = computed(() =>
    this.editing()
      ? EDITING_LABEL
      : (this.chapters().find((chapter) => chapter.active)?.label ?? ''),
  );

  protected readonly caption = computed(() =>
    this.editing() ? EDITING_CAPTION : `Trin ${this.stepNumber()} af ${this.stepTotal()}`,
  );
}
