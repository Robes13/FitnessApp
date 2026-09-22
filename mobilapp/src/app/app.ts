import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Rodkomponenten: kun en `<router-outlet>`. Den udgør telefonens "skærm" – fuld højde,
 * begrænset til `--layout-max-width` og med app-baggrunden. Alt indhold kommer fra routeren.
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
