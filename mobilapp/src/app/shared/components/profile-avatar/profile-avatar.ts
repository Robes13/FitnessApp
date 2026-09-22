import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProfilePhoto } from '../../../core/models/profile';
import { photoBackgroundImage, photoBackgroundPosition, photoBackgroundSize } from './photo-crop';

/** 44 / 72 / 132 / 196 px – `--size-avatar-sm` / `-md` / `-lg` / `-xl`. */
export type ProfileAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Brugerens avatar: enten det beskårne profilbillede eller en blå cirkel med forbogstavet.
 *
 * Beskæringen sættes som `background-size` / `background-position` i procent, så de samme
 * værdier giver det samme udsnit i alle tre størrelser (avatar, forhåndsvisning, editor).
 * Avataren er rent dekorativ – navnet står ved siden af – og derfor `aria-hidden`.
 */
@Component({
  selector: 'app-profile-avatar',
  templateUrl: './profile-avatar.html',
  styleUrl: './profile-avatar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'profile-avatar',
    'aria-hidden': 'true',
    '[class]': 'hostClasses()',
    '[style.background-image]': 'backgroundImage()',
    '[style.background-size]': 'backgroundSize()',
    '[style.background-position]': 'backgroundPosition()',
  },
})
export class ProfileAvatar {
  readonly photo = input<ProfilePhoto | null>(null);
  readonly initial = input('');
  readonly size = input<ProfileAvatarSize>('md');

  protected readonly hasPhoto = computed(() => this.photo() !== null);
  protected readonly backgroundImage = computed(() => photoBackgroundImage(this.photo()));
  protected readonly backgroundSize = computed(() => photoBackgroundSize(this.photo()));
  protected readonly backgroundPosition = computed(() => photoBackgroundPosition(this.photo()));

  protected readonly hostClasses = computed(() =>
    this.hasPhoto()
      ? `profile-avatar profile-avatar--${this.size()} profile-avatar--photo`
      : `profile-avatar profile-avatar--${this.size()}`,
  );
}
