import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';

/**
 * Fejrings-toasten "Dagsmål nået". Den popper ind, fader ud af sig selv efter knap tre
 * sekunder og kan trykkes væk. `HomePage` ejer, hvor længe den er på skærmen.
 */
@Component({
  selector: 'app-home-celebration-toast',
  imports: [UiIcon],
  templateUrl: './home-celebration-toast.html',
  styleUrl: './home-celebration-toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-celebration-toast', role: 'status' },
})
export class HomeCelebrationToast {
  readonly dismissed = output<void>();
}
