import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ProfilePhoto } from '../../../../core/models/profile';
import { UserProfileService } from '../../../../core/services/user-profile';
import { formatDecimal } from '../../../../core/utils/date-format';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import {
  CENTERED_CROP,
  PHOTO_ZOOM_PERCENT_MAX,
  PHOTO_ZOOM_PERCENT_MIN,
  PhotoCrop,
  clampPhotoZoom,
  movePhotoCrop,
  photoZoomPercent,
} from '../../../../shared/components/profile-avatar/photo-crop';

interface DragStart extends PhotoCrop {
  readonly pointerX: number;
  readonly pointerY: number;
}

const PERCENT = 100;
/** These texts don't exist in the design – the file selection can't fail in the prototype. */
const READ_ERROR = 'Billedet kunne ikke indlæses. Prøv et andet.';

interface KeyDirection {
  readonly x: number;
  readonly y: number;
}

/** The arrow keys correspond to a drag in the same direction. */
const KEY_DIRECTIONS: Readonly<Record<string, KeyDirection | undefined>> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};

/** How many pixels one key press corresponds to – Shift gives a bigger jump. */
const KEY_STEP_PX = 8;
const KEY_STEP_LARGE_PX = 24;

/**
 * The "Profilbillede" bottom sheet: pick an image from the file system and crop it by
 * dragging and zooming within the circle. There's no camera or gallery – the design
 * deliberately uses a file picker.
 *
 * All changes are written directly to the profile, so the avatar behind the sheet updates
 * along with it. "Brug billedet" therefore just closes the sheet.
 */
@Component({
  selector: 'app-profile-photo-sheet',
  imports: [ProfileAvatar, UiButton, UiFormError, UiIcon, UiSheet],
  templateUrl: './profile-photo-sheet.html',
  styleUrl: './profile-photo-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePhotoSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  private readonly profiles = inject(UserProfileService);

  protected readonly zoomMin = PHOTO_ZOOM_PERCENT_MIN;
  protected readonly zoomMax = PHOTO_ZOOM_PERCENT_MAX;

  protected readonly photo = computed(() => this.profiles.profile().photo);
  protected readonly initial = this.profiles.initial;
  protected readonly zoomPercent = computed(() => {
    const photo = this.photo();
    return photo ? photoZoomPercent(photo.zoom) : PHOTO_ZOOM_PERCENT_MIN;
  });
  protected readonly zoomLabel = computed(
    () => `${formatDecimal(this.zoomPercent() / PERCENT, 1)}×`,
  );

  protected readonly errorMessage = signal<string | null>(null);

  private dragStart: DragStart | null = null;

  protected onClose(): void {
    this.closed.emit();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // The field is reset so the same image can be selected again after "Fjern foto".
    input.value = '';
    if (!file) {
      return;
    }
    this.errorMessage.set(null);
    readImage(file).then(
      (image) => this.setPhoto(image.dataUrl, image.aspectRatio),
      () => this.errorMessage.set(READ_ERROR),
    );
  }

  protected onPointerDown(event: PointerEvent): void {
    const photo = this.photo();
    if (!photo) {
      return;
    }
    this.dragStart = {
      zoom: photo.zoom,
      x: photo.x,
      y: photo.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
  }

  protected onPointerMove(event: PointerEvent): void {
    const start = this.dragStart;
    if (!start) {
      return;
    }
    const moved = movePhotoCrop(
      start,
      event.clientX - start.pointerX,
      event.clientY - start.pointerY,
    );
    this.updatePhoto(moved);
  }

  protected onPointerUp(): void {
    this.dragStart = null;
  }

  /**
   * The keyboard path to the same crop as the drag. Each press is computed from the
   * *current* crop, because `movePhotoCrop` expects a total drag from its starting
   * point – not an accumulated sum.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const photo = this.photo();
    const direction = KEY_DIRECTIONS[event.key];
    if (!photo || !direction) {
      return;
    }
    event.preventDefault();
    const step = event.shiftKey ? KEY_STEP_LARGE_PX : KEY_STEP_PX;
    this.updatePhoto(movePhotoCrop(photo, direction.x * step, direction.y * step));
  }

  protected onZoomChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.updatePhoto({ zoom: clampPhotoZoom(value / PERCENT) });
  }

  protected recenter(): void {
    this.updatePhoto({ ...CENTERED_CROP });
  }

  protected removePhoto(): void {
    this.errorMessage.set(null);
    this.profiles.update({ photo: null });
  }

  private setPhoto(dataUrl: string, aspectRatio: number): void {
    this.profiles.update({ photo: { dataUrl, aspectRatio, ...CENTERED_CROP } });
  }

  private updatePhoto(patch: Partial<PhotoCrop>): void {
    const photo = this.photo();
    if (!photo) {
      return;
    }
    const next: ProfilePhoto = { ...photo, ...patch };
    this.profiles.update({ photo: next });
  }
}

interface LoadedImage {
  readonly dataUrl: string;
  readonly aspectRatio: number;
}

/**
 * Reads the file as a data URL and measures its image aspect ratio. The ratio determines
 * whether the crop scales by height or width.
 */
function readImage(file: File): Promise<LoadedImage> {
  return new Promise<LoadedImage>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read-failed'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('read-failed'));
        return;
      }
      const image = new Image();
      image.onerror = () => reject(new Error('decode-failed'));
      image.onload = () =>
        resolve({
          dataUrl,
          aspectRatio: image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 1,
        });
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
