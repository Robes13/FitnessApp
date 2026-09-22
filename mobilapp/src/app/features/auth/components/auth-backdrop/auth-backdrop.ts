import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { AUTH_ASSET } from '../../auth-assets';

/**
 * Fotobaggrunden bag login og glemt adgangskode: billedet fylder hele skærmen
 * (`object-fit: cover`, forankret i toppen som i designet).
 *
 * `gradient` lægger designets mørke forløb oven på fotoet, så teksten i bunden kan læses.
 * Kun glemt adgangskode bruger det – login har teksten på den mørke del af fotoet.
 */
@Component({
  selector: 'app-auth-backdrop',
  templateUrl: './auth-backdrop.html',
  styleUrl: './auth-backdrop.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'auth-backdrop',
    'aria-hidden': 'true',
  },
})
export class AuthBackdrop {
  readonly gradient = input(false, { transform: booleanAttribute });

  protected readonly imageSrc = AUTH_ASSET.BACKDROP;
}
