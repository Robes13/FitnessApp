import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { AUTH_ASSET } from '../../auth-assets';

/**
 * The photo background behind login and forgot password: the image fills the whole screen
 * (`object-fit: cover`, anchored to the top as in the design).
 *
 * `gradient` lays the design's dark gradient over the photo so the text at the bottom stays readable.
 * Only forgot password uses it – login has its text over the dark part of the photo.
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
