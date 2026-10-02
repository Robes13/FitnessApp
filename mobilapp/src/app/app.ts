import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { KeyboardService } from './core/services/keyboard/keyboard';

/**
 * The root component: just a `<router-outlet>`. It represents the phone's "screen" – full
 * height, constrained to `--layout-max-width`, with the app background. All content comes
 * from the router. A tap anywhere in it outside a text field closes the on-screen keyboard.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'app-root' },
})
export class App {
  constructor() {
    inject(KeyboardService).closeOnTapsIn(
      inject<ElementRef<HTMLElement>>(ElementRef).nativeElement,
    );
  }
}
