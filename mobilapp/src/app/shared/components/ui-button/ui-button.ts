import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
} from '@angular/core';
import { UiSpinner } from '../ui-spinner/ui-spinner';

/**
 * `outline` er gennemsigtig med hairline, `surface` lægger glas-fyld bag den samme hairline
 * (designets "Søg vare"/"Scan" og fotoarkets sekundære knapper), og `outline-danger` er en
 * hairline med rød tekst (designets "Log ud").
 */
export type UiButtonVariant =
  'primary' | 'outline' | 'surface' | 'outline-danger' | 'ghost' | 'danger' | 'subtle';
/** 56 / 52 / 48 / 44 px – `--size-control-xl` / `-lg` / `-md` / `-sm`. */
export type UiButtonSize = 'xl' | 'lg' | 'md' | 'sm';
/** `pill` er designets standardknap; `rounded` er den lave 14 px-radius (fotoarket). */
export type UiButtonShape = 'pill' | 'rounded';

/**
 * Designets `.pill`-knap og dens varianter. Bruges som attribut på et native `<button>`
 * eller `<a>`, så native `disabled`, `type` og routerLink virker uændret.
 *
 * `loading` viser en `UiSpinner`, sætter `aria-busy`/`aria-disabled` og blokerer klik, mens
 * der arbejdes.
 *
 * Afviger designet fra størrelsesskalaen på en enkelt skærm, kan forælderen sætte
 * `--ui-button-min-height` på knappen i stedet for at kopiere hele knappens styling.
 */
@Component({
  selector: 'button[app-ui-button], a[app-ui-button]',
  imports: [UiSpinner],
  templateUrl: './ui-button.html',
  styleUrl: './ui-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    '[class.ui-button--block]': 'block()',
    '[class.ui-button--loading]': 'loading()',
    '[attr.aria-busy]': 'loading() || null',
    '[attr.aria-disabled]': 'loading() || null',
    '(click)': 'onClick($event)',
  },
})
export class UiButton {
  readonly variant = input<UiButtonVariant>('primary');
  readonly size = input<UiButtonSize>('xl');
  readonly shape = input<UiButtonShape>('pill');
  /** Fylder hele bredden. */
  readonly block = input(false, { transform: booleanAttribute });
  /** Viser spinner og blokerer klik. */
  readonly loading = input(false, { transform: booleanAttribute });

  protected readonly hostClasses = computed(
    () =>
      `ui-button ui-button--${this.variant()} ui-button--${this.size()} ui-button--${this.shape()}`,
  );

  protected onClick(event: Event): void {
    if (this.loading()) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
}
