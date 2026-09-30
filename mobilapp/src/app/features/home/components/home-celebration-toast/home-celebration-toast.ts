import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';

/**
 * The "Dagsmål nået" celebration toast. It pops in, fades out on its own after just
 * under three seconds, and can be dismissed with a tap. `HomePage` owns how long it stays
 * on screen.
 */
@Component({
  selector: 'app-home-celebration-toast',
  imports: [UiIcon, TranslatePipe],
  templateUrl: './home-celebration-toast.html',
  styleUrl: './home-celebration-toast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'home-celebration-toast', role: 'status' },
})
export class HomeCelebrationToast {
  readonly dismissed = output<void>();
}
