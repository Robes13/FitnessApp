import { ProfilePhoto } from '../../../core/models/profile';
import { clamp } from '../../../core/utils/math';

export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 3;
export const PHOTO_ZOOM_PERCENT_MIN = 100;
export const PHOTO_ZOOM_PERCENT_MAX = 300;

const PERCENT = 100;
/** Design's `photoMove`: how far the finger has to move to pan across the whole image. */
const DRAG_SPAN_PER_ZOOM = 260;
const DRAG_SPAN_BASE = 40;
const DRAG_SPAN_MIN = 20;

/** The starting point for a new crop: fully zoomed out and centered. */
export const CENTERED_CROP: Readonly<Pick<ProfilePhoto, 'zoom' | 'x' | 'y'>> = {
  zoom: PHOTO_ZOOM_MIN,
  x: 50,
  y: 50,
};

export type PhotoCrop = Pick<ProfilePhoto, 'zoom' | 'x' | 'y'>;

/**
 * The crop is expressed as `background-size` and `background-position` in **percent**, not in
 * pixels. That's why the same three numbers (`zoom`, `x`, `y`) produce exactly the same crop in
 * the 196 px editor, the 132 px preview and the 72 px avatar. The formulas are design's
 * `photoSize` / `photoPos`.
 */
export function photoZoomPercent(zoom: number): number {
  return Math.round(zoom * PERCENT);
}

/**
 * `dataUrl` is a data URL while cropping, otherwise the API's `profileImageUrl`. In Development it
 * is relative (`/api/v1/dev-images/…`): in the browser it stays so and the dev proxy forwards
 * `/api` to the API; on native the profile mapping (`toProfilePhoto`) has made it absolute
 * against the API. (The Android emulator's https WebView still blocks that http image as mixed
 * content; iOS shows it. Production URLs are https.)
 */
export function photoBackgroundImage(photo: ProfilePhoto | null): string {
  return photo ? `url("${photo.dataUrl}")` : 'none';
}

/** The short side is filled, the long side gets `auto` – otherwise the image would be distorted. */
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

/** The side, in pixels, of the square photo that is baked from the crop and uploaded. */
export const BAKED_PHOTO_SIZE = 512;

/** Where the whole image is drawn on the square canvas, in canvas pixels. */
export interface PhotoDrawRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where to draw the image on a `size` × `size` canvas, so the canvas shows exactly the crop the
 * avatar shows: the cover sizing of `photoBackgroundSize` (the short side is `zoom` × the canvas)
 * and the offset of `photoBackgroundPosition` (`x`/`y` percent of the overflow).
 */
export function photoDrawRect(photo: ProfilePhoto, size = BAKED_PHOTO_SIZE): PhotoDrawRect {
  const shortSide = (size * photoZoomPercent(photo.zoom)) / PERCENT;
  const landscape = photo.aspectRatio >= 1;
  const width = landscape ? shortSide * photo.aspectRatio : shortSide;
  const height = landscape ? shortSide : shortSide / photo.aspectRatio;
  return {
    x: ((size - width) * photo.x) / PERCENT,
    y: ((size - height) * photo.y) / PERCENT,
    width,
    height,
  };
}

/** Pixels per 100% offset. The further zoomed in, the further the finger has to move. */
export function photoDragSpan(zoom: number): number {
  return Math.max(DRAG_SPAN_MIN, DRAG_SPAN_PER_ZOOM * (zoom - 1) + DRAG_SPAN_BASE);
}

/**
 * The new position after a drag. `start` is the crop as it was when the finger was placed, and
 * `deltaX`/`deltaY` is the total movement since then – so the drag doesn't drift from rounding along the way.
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
