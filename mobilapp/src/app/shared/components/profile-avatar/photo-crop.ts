import { ProfilePhoto } from '../../../core/models/profile';
import { clamp } from '../../../core/utils/math';

export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 3;
export const PHOTO_ZOOM_PERCENT_MIN = 100;
export const PHOTO_ZOOM_PERCENT_MAX = 300;

const PERCENT = 100;
/** Designets `photoMove`: hvor langt fingeren skal flytte sig for at panorere hele billedet. */
const DRAG_SPAN_PER_ZOOM = 260;
const DRAG_SPAN_BASE = 40;
const DRAG_SPAN_MIN = 20;

/** Udgangspunktet for en ny beskæring: helt zoomet ud og centreret. */
export const CENTERED_CROP: Readonly<Pick<ProfilePhoto, 'zoom' | 'x' | 'y'>> = {
  zoom: PHOTO_ZOOM_MIN,
  x: 50,
  y: 50,
};

export type PhotoCrop = Pick<ProfilePhoto, 'zoom' | 'x' | 'y'>;

/**
 * Beskæringen udtrykkes som `background-size` og `background-position` i **procent**, ikke i
 * pixels. Derfor giver de samme tre tal (`zoom`, `x`, `y`) nøjagtig samme udsnit i
 * 196 px-editoren, 132 px-forhåndsvisningen og 72 px-avataren. Formlerne er designets
 * `photoSize` / `photoPos`.
 */
export function photoZoomPercent(zoom: number): number {
  return Math.round(zoom * PERCENT);
}

export function photoBackgroundImage(photo: ProfilePhoto | null): string {
  return photo ? `url("${photo.dataUrl}")` : 'none';
}

/** Den korte side fyldes, den lange får `auto` – ellers ville billedet blive forvrænget. */
export function photoBackgroundSize(photo: ProfilePhoto | null): string {
  if (!photo) {
    return 'auto';
  }
  const zoom = `${photoZoomPercent(photo.zoom)}%`;
  return photo.aspectRatio >= 1 ? `auto ${zoom}` : `${zoom} auto`;
}

export function photoBackgroundPosition(photo: ProfilePhoto | null): string {
  return photo ? `${photo.x}% ${photo.y}%` : `${CENTERED_CROP.x}% ${CENTERED_CROP.y}%`;
}

/** Pixels pr. 100 % forskydning. Jo mere zoomet ind, jo længere skal fingeren flytte sig. */
export function photoDragSpan(zoom: number): number {
  return Math.max(DRAG_SPAN_MIN, DRAG_SPAN_PER_ZOOM * (zoom - 1) + DRAG_SPAN_BASE);
}

/**
 * Ny position efter et træk. `start` er beskæringen, da fingeren blev sat, og `deltaX`/`deltaY`
 * er den samlede bevægelse siden – så trækket ikke driver ved afrunding undervejs.
 */
export function movePhotoCrop(
  start: PhotoCrop,
  deltaX: number,
  deltaY: number,
): Pick<PhotoCrop, 'x' | 'y'> {
  const span = photoDragSpan(start.zoom);
  return {
    x: clampPercent(start.x - (deltaX / span) * PERCENT),
    y: clampPercent(start.y - (deltaY / span) * PERCENT),
  };
}

export function clampPhotoZoom(zoom: number): number {
  return clamp(zoom, PHOTO_ZOOM_MIN, PHOTO_ZOOM_MAX);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(PERCENT, value));
}
