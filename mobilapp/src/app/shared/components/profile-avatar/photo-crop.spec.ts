import { ProfilePhoto } from '../../../core/models/profile';
import {
  CENTERED_CROP,
  clampPhotoZoom,
  movePhotoCrop,
  photoBackgroundImage,
  photoBackgroundPosition,
  photoBackgroundSize,
  photoDragSpan,
  photoZoomPercent,
} from './photo-crop';

function photo(patch: Partial<ProfilePhoto> = {}): ProfilePhoto {
  return { dataUrl: 'data:image/png;base64,AAA', aspectRatio: 1.5, ...CENTERED_CROP, ...patch };
}

describe('photo-crop', () => {
  it('renders no background without a photo', () => {
    expect(photoBackgroundImage(null)).toBe('none');
    expect(photoBackgroundSize(null)).toBe('auto');
    expect(photoBackgroundPosition(null)).toBe('50% 50%');
  });

  it('wraps the data URL in url()', () => {
    expect(photoBackgroundImage(photo())).toBe('url("data:image/png;base64,AAA")');
  });

  it('scales a landscape photo by its height and a portrait photo by its width', () => {
    expect(photoBackgroundSize(photo({ aspectRatio: 1.5, zoom: 1 }))).toBe('auto 100%');
    expect(photoBackgroundSize(photo({ aspectRatio: 0.75, zoom: 1 }))).toBe('100% auto');
  });

  it('expresses zoom in whole percent', () => {
    expect(photoZoomPercent(1)).toBe(100);
    expect(photoZoomPercent(2.345)).toBe(235);
    expect(photoBackgroundSize(photo({ aspectRatio: 2, zoom: 2.5 }))).toBe('auto 250%');
  });

  it('positions by percent, so the same crop fits every avatar size', () => {
    expect(photoBackgroundPosition(photo({ x: 20, y: 80 }))).toBe('20% 80%');
  });

  it('needs a longer drag the further the photo is zoomed in', () => {
    expect(photoDragSpan(1)).toBe(40);
    expect(photoDragSpan(2)).toBe(300);
    expect(photoDragSpan(3)).toBe(560);
  });

  it('moves the crop opposite the drag direction', () => {
    // Zoom 1 → 40 px svarer til hele billedet, så 10 px er 25 %.
    expect(movePhotoCrop({ zoom: 1, x: 50, y: 50 }, 10, -4)).toEqual({ x: 25, y: 60 });
  });

  it('clamps the crop to the edges of the photo', () => {
    expect(movePhotoCrop({ zoom: 1, x: 50, y: 50 }, -100, 100)).toEqual({ x: 100, y: 0 });
  });

  it('keeps zoom between 1 and 3', () => {
    expect(clampPhotoZoom(0.4)).toBe(1);
    expect(clampPhotoZoom(1.8)).toBe(1.8);
    expect(clampPhotoZoom(9)).toBe(3);
  });
});
