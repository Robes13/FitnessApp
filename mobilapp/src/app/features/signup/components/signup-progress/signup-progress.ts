import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { UiProgressRing } from '../../../../shared/components/ui-progress-ring/ui-progress-ring';
import { SignupChapter } from '../../services/signup-state';

/** Designets `chapterLabel`, når brugeren retter et svar fra opsummeringen. */
const EDITING_LABEL = 'Retter';
const EDITING_CAPTION = 'Tilbage til opsummering';

/** 48 px ring med 3 px streg – designets fremdriftsring i signup-headeren. */
const RING_DIAMETER = 48;
const RING_STROKE_WIDTH = 3;

/**
 * Fremdriften øverst i oprettelsesflowet: ring med trinnummeret, kapitelnavn +
 * "Trin x af y" og en bjælke pr. kapitel, hvis bredde følger antallet af synlige trin.
 *
 * Komponenten er ren præsentation – siden leverer de afledte værdier fra
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
  /** Andel 0..1 til ringen. */
  readonly value = input.required<number>();
  readonly chapters = input.required<readonly SignupChapter[]>();
  /** Retter brugeren et svar fra opsummeringen, skifter overskrift og undertekst. */
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
