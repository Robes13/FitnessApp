import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { WEIGHT_MAX_KG, WEIGHT_MIN_KG } from '../../../../core/constants/nutrition';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiChip } from '../../../../shared/components/ui-chip/ui-chip';
import { RULER_BLEED_IDLE_STRONG } from '../../../../shared/components/ui-ruler/ruler-geometry';
import { UiRuler } from '../../../../shared/components/ui-ruler/ui-ruler';
import { WeightChart } from '../../components/weight-chart/weight-chart';
import { WeightLogList } from '../../components/weight-log-list/weight-log-list';
import { WeightScaleScene } from '../../components/weight-scale-scene/weight-scale-scene';
import { WEIGHT_STEP_KG, WeightViewService } from '../../services/weight-view';

/** Hvor længe knappen viser "Gemt ✓" efter en vejning. */
const SAVED_LABEL_MS = 1400;
/** Hvor længe pupillerne følger den retning, vægten blev ændret i. */
const LOOK_DURATION_MS = 900;

const SAVE_LABEL = 'Gem vejning';
const SAVED_LABEL = 'Gemt ✓';

/**
 * Vægt-skærmen: registrér dagens vægt på badevægten, gem vejningen og se udviklingen.
 *
 * Al afledt logik ligger i `WeightViewService`, som siden selv udstiller, så kladden og det
 * valgte interval hører til skærmen. Siden holder kun de to kortlivede animationstilstande:
 * "Gemt ✓" på knappen og figurens blik, der følger den retning, vægten blev ændret i.
 */
@Component({
  selector: 'app-weight-page',
  imports: [UiButton, UiChip, UiRuler, WeightChart, WeightLogList, WeightScaleScene],
  templateUrl: './weight-page.html',
  styleUrl: './weight-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [WeightViewService],
  host: { class: 'weight-page' },
})
export class WeightPage {
  protected readonly view = inject(WeightViewService);

  protected readonly rulerGlowStrength = RULER_BLEED_IDLE_STRONG;
  protected readonly minKg = WEIGHT_MIN_KG;
  protected readonly maxKg = WEIGHT_MAX_KG;
  protected readonly stepKg = WEIGHT_STEP_KG;

  private readonly saved = signal(false);
  private readonly lookDirectionState = signal(0);
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private lookTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly isSaved = this.saved.asReadonly();
  protected readonly lookDirection = this.lookDirectionState.asReadonly();
  protected readonly saveLabel = computed(() => (this.saved() ? SAVED_LABEL : SAVE_LABEL));
  protected readonly deltaClass = computed(
    () => `weight-page__tile-value--${this.view.deltaTone()}`,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.clearTimer(this.savedTimer);
      this.clearTimer(this.lookTimer);
    });
  }

  /** Linealen: sæt kladden og lad blikket følge retningen. */
  protected onDraftChange(kg: number): void {
    const direction = Math.sign(kg - this.view.draftKg()) || this.lookDirectionState();
    this.view.setDraftKg(kg);
    this.look(direction);
  }

  /** −/+ knapperne: ét trin på 0,1 kg. */
  protected stepDraft(direction: number): void {
    this.view.adjustDraftKg(direction * WEIGHT_STEP_KG);
    this.look(direction);
  }

  protected save(): void {
    this.view.save();
    this.saved.set(true);
    this.clearTimer(this.savedTimer);
    this.savedTimer = setTimeout(() => {
      this.saved.set(false);
      this.savedTimer = null;
    }, SAVED_LABEL_MS);
  }

  private look(direction: number): void {
    this.lookDirectionState.set(direction);
    this.clearTimer(this.lookTimer);
    this.lookTimer = setTimeout(() => {
      this.lookDirectionState.set(0);
      this.lookTimer = null;
    }, LOOK_DURATION_MS);
  }

  private clearTimer(timer: ReturnType<typeof setTimeout> | null): void {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}
