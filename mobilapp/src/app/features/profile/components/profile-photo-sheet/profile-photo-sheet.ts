import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Observable, defer, switchMap } from 'rxjs';
import { ProfilePhoto } from '../../../../core/models/profile';
import { injectTranslate } from '../../../../core/services/language/translate';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import { formatDecimal } from '../../../../core/utils/date-format';
import { UiButton } from '../../../../shared/components/ui-button/ui-button';
import { UiFormError } from '../../../../shared/components/ui-form-error/ui-form-error';
import { UiIcon } from '../../../../shared/components/ui-icon/ui-icon';
import { UiSheet } from '../../../../shared/components/ui-sheet/ui-sheet';
import { ProfileAvatar } from '../../../../shared/components/profile-avatar/profile-avatar';
import {
  BAKED_PHOTO_SIZE,
  CENTERED_CROP,
  PHOTO_ZOOM_PERCENT_MAX,
  PHOTO_ZOOM_PERCENT_MIN,
  PhotoCrop,
  clampPhotoZoom,
  movePhotoCrop,
  photoDrawRect,
  photoZoomPercent,
} from '../../../../shared/components/profile-avatar/photo-crop';

interface DragStart extends PhotoCrop {
  readonly pointerX: number;
  readonly pointerY: number;
}

const PERCENT = 100;
const PHOTO_MAX_DIMENSION = 768;
const PHOTO_JPEG_QUALITY = 0.8;
const BAKED_JPEG_QUALITY = 0.85;
const JPEG_TYPE = 'image/jpeg';
/** Spec 2.4-4a: the browser can't decode the file, so it isn't an image the app can use. */
const READ_ERROR_KEY = 'profile.photoSheet.readError';
/** Any failed upload or removal – the upload is a re-encoded JPEG, so the API's 400 can't be hit. */
const SAVE_ERROR_KEY = 'profile.photoSheet.saveError';

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

/** The two calls the sheet makes. */
type PhotoSaveAction = 'upload' | 'remove';

/**
 * The "Profilbillede" bottom sheet: pick an image (the file input offers the gallery and the
 * camera) and crop it by dragging and zooming within the circle.
 *
 * The picked image is a **draft** – nothing is saved while cropping. "Brug billedet" bakes the
 * crop into a 512 × 512 JPEG and uploads it; closing the sheet without it discards the draft
 * (spec 2.4-6a). "Fjern foto" removes the profile photo in the API.
 */
@Component({
  selector: 'app-profile-photo-sheet',
  imports: [ProfileAvatar, TranslatePipe, UiButton, UiFormError, UiIcon, UiSheet],
  templateUrl: './profile-photo-sheet.html',
  styleUrl: './profile-photo-sheet.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePhotoSheet {
  readonly open = input.required<boolean>();

  readonly closed = output<void>();

  private readonly profiles = inject(UserProfileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly t = injectTranslate();

  protected readonly zoomMin = PHOTO_ZOOM_PERCENT_MIN;
  protected readonly zoomMax = PHOTO_ZOOM_PERCENT_MAX;

  /** The picked image and its crop – only saved by "Brug billedet". */
  private readonly draft = signal<ProfilePhoto | null>(null);
  protected readonly photo = this.draft.asReadonly();
  /** The saved photo, shown while no new image is picked. */
  protected readonly savedPhoto = computed(() => this.profiles.profile().photo);
  protected readonly initial = this.profiles.initial;
  /** The call in progress, if any – the buttons show which. */
  private readonly busy = signal<PhotoSaveAction | null>(null);
  protected readonly uploading = computed(() => this.busy() === 'upload');
  protected readonly removing = computed(() => this.busy() === 'remove');
  protected readonly zoomPercent = computed(() => {
    const photo = this.photo();
    return photo ? photoZoomPercent(photo.zoom) : PHOTO_ZOOM_PERCENT_MIN;
  });
  protected readonly zoomLabel = computed(
    () => `${formatDecimal(this.zoomPercent() / PERCENT, 1)}×`,
  );

  /** The key of the shown error, translated in `errorMessage` so it follows the language. */
  private readonly errorKey = signal<string | null>(null);
  protected readonly errorMessage = computed(() => {
    const key = this.errorKey();
    return key === null ? null : this.t(key);
  });

  private dragStart: DragStart | null = null;

  /** Closing discards the draft – only "Brug billedet" saves it. */
  protected onClose(): void {
    this.draft.set(null);
    this.errorKey.set(null);
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
    this.errorKey.set(null);
    readImage(file).then(
      (image) => this.draft.set({ ...image, ...CENTERED_CROP }),
      () => this.errorKey.set(READ_ERROR_KEY),
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
    this.updateDraft(moved);
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
    this.updateDraft(movePhotoCrop(photo, direction.x * step, direction.y * step));
  }

  protected onZoomChange(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.updateDraft({ zoom: clampPhotoZoom(value / PERCENT) });
  }

  protected recenter(): void {
    this.updateDraft({ ...CENTERED_CROP });
  }

  /** "Brug billedet": bakes the crop, uploads it and closes once the API has it. */
  protected usePhoto(): void {
    const draft = this.draft();
    if (draft !== null) {
      const upload = defer(() => bakePhoto(draft)).pipe(
        switchMap((blob) => this.profiles.uploadPhoto(blob)),
      );
      this.save('upload', upload, () => this.onClose());
    }
  }

  /** Removes the profile photo in the API (404 = already gone) and drops the draft. */
  protected removePhoto(): void {
    this.save('remove', this.profiles.deletePhoto(), () => this.draft.set(null));
  }

  /** Pessimistic: `done` runs once the API has answered; on an error the draft stays. */
  private save(action: PhotoSaveAction, request: Observable<void>, done: () => void): void {
    if (this.busy() !== null) {
      return;
    }
    this.busy.set(action);
    this.errorKey.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(null);
        done();
      },
      error: () => {
        this.busy.set(null);
        this.errorKey.set(SAVE_ERROR_KEY);
      },
    });
  }

  private updateDraft(patch: Partial<PhotoCrop>): void {
    this.draft.update((draft) => (draft ? { ...draft, ...patch } : draft));
  }
}

interface LoadedImage {
  readonly dataUrl: string;
  readonly aspectRatio: number;
}

/**
 * Reads the file as a data URL and measures its image aspect ratio. The ratio determines
 * whether the crop scales by height or width. Rejects when the browser can't decode the file.
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
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(
            1,
            PHOTO_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
          );
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('resize-failed');
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({
            dataUrl: canvas.toDataURL(JPEG_TYPE, PHOTO_JPEG_QUALITY),
            aspectRatio: canvas.width / canvas.height,
          });
        } catch (error: unknown) {
          reject(error);
        }
      };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Draws the crop onto a 512 × 512 canvas – exactly what the avatar shows (`photoDrawRect`) –
 * and encodes it as the JPEG that is uploaded.
 */
function bakePhoto(photo: ProfilePhoto): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error('decode-failed'));
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = BAKED_PHOTO_SIZE;
      canvas.height = BAKED_PHOTO_SIZE;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('bake-failed'));
        return;
      }
      const rect = photoDrawRect(photo);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('bake-failed'))),
        JPEG_TYPE,
        BAKED_JPEG_QUALITY,
      );
    };
    image.src = photo.dataUrl;
  });
}
