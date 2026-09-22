import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * The root component: just a `<router-outlet>`. It represents the phone's "screen" – full
 * height, constrained to `--layout-max-width`, with the app background. All content comes
 * from the router.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-root' },
})
export class App {}
