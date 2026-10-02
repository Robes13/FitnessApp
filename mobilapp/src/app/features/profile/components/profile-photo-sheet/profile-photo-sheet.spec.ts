import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfilePhoto } from '../../../../core/models/profile';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { ProfilePhotoSheet } from './profile-photo-sheet';

const PROFILE_IMAGE = '/api/v1/me/profile/image';
const DEV_IMAGE_URL = '/api/v1/dev-images/3f2a.jpg';
const SAVED_PHOTO: ProfilePhoto = { dataUrl: DEV_IMAGE_URL, aspectRatio: 1, zoom: 1, x: 50, y: 50 };

/** What the stubbed `Image` does with its `src`: decode it, or fail like a file that isn't an image. */
let decodes = true;

describe('ProfilePhotoSheet', () => {
  const drawImage = vi.fn();
  let fixture: ComponentFixture<ProfilePhotoSheet>;
  let host: HTMLElement;
  let closed: ReturnType<typeof vi.fn<() => void>>;

  async function setup(): Promise<void> {
    fixture = TestBed.createComponent(ProfilePhotoSheet);
    fixture.componentRef.setInput('open', true);
    closed = vi.fn<() => void>();
    fixture.componentInstance.closed.subscribe(closed);
    await fixture.whenStable();
    host = fixture.nativeElement as HTMLElement;
  }

  async function selectPhoto(): Promise<void> {
    const input = host.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File(['photo'], 'photo.jpg')] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  async function click(text: string): Promise<void> {
    Array.from(host.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === text)
      ?.click();
    await fixture.whenStable();
  }

  function photo(): ProfilePhoto | null {
    return TestBed.inject(UserProfileService).profile().photo;
  }

  function error(): string {
    return host.querySelector('app-ui-form-error')?.textContent?.trim() ?? '';
  }

  beforeEach(() => {
    decodes = true;
    resetComponentTestStorage();
    TestBed.configureTestingModule({ providers: provideComponentTestEnvironment() });
    vi.stubGlobal(
      'FileReader',
      class {
        result = 'data:image/jpeg;base64,original';
        onload = (): void => {};
        readAsDataURL(): void {
          this.onload();
        }
      },
    );
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 6000;
        naturalHeight = 4000;
        onload = (): void => {};
        onerror = (): void => {};
        set src(_value: string) {
          if (decodes) {
            this.onload();
          } else {
            this.onerror();
          }
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,small',
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(new Blob(['baked'], { type: 'image/jpeg' })),
    );
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    drawImage.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('crops a resized draft and saves nothing while editing', async () => {
    await setup();
    await selectPhoto();

    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 768, 512);
    expect(host.querySelector('.profile-photo-sheet__crop')).not.toBeNull();
    expect(photo()).toBeNull();
  });

  it('bakes the crop into a 512 px JPEG, uploads it and closes', async () => {
    await setup();
    await selectPhoto();

    await click('Brug billedet');
    // The 3:2 draft fills the canvas' height, centred.
    expect(drawImage).toHaveBeenLastCalledWith(expect.anything(), -128, 0, 768, 512);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.85,
    );
    const request = TestBed.inject(HttpTestingController).expectOne({
      method: 'PUT',
      url: PROFILE_IMAGE,
    });
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
    expect(host.querySelector('.profile-photo-sheet__use app-ui-spinner')).not.toBeNull();
    request.flush({ profileImageUrl: DEV_IMAGE_URL });
    await fixture.whenStable();

    expect(photo()).toEqual(SAVED_PHOTO);
    expect(closed).toHaveBeenCalledOnce();
  });

  it('offers the camera next to the gallery (Android only opens it with capture)', async () => {
    await setup();
    const camera = host.querySelector<HTMLInputElement>('input[type=file][capture]');
    expect(camera?.getAttribute('capture')).toBe('user');
    expect(camera?.accept).toBe('image/*');

    await selectPhoto();
    expect(host.querySelector('input[type=file][capture]')).not.toBeNull();
  });

  it("can't be closed and takes no new file while the upload runs", async () => {
    await setup();
    await selectPhoto();

    await click('Brug billedet');
    const request = TestBed.inject(HttpTestingController).expectOne(PROFILE_IMAGE);
    expect(host.querySelector('.ui-sheet__close')).toBeNull();
    decodes = false;
    await selectPhoto();
    expect(error()).toBe('');

    request.flush({ profileImageUrl: DEV_IMAGE_URL });
    await fixture.whenStable();
    expect(closed).toHaveBeenCalledOnce();
  });

  it('shows the save error and keeps the draft when the upload fails', async () => {
    await setup();
    await selectPhoto();

    await click('Brug billedet');
    TestBed.inject(HttpTestingController)
      .expectOne(PROFILE_IMAGE)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect(error()).toBe('Billedet kunne ikke gemmes. Prøv igen.');
    expect(host.querySelector('.profile-photo-sheet__crop')).not.toBeNull();
    expect(photo()).toBeNull();
    expect(closed).not.toHaveBeenCalled();
  });

  it("rejects a file the browser can't decode and uploads nothing", async () => {
    decodes = false;
    await setup();
    await selectPhoto();

    expect(error()).toBe('Billedet kan ikke bruges – vælg et andet (fx JPEG, PNG eller WebP).');
    expect(host.querySelector('.profile-photo-sheet__crop')).toBeNull();
    expect(host.textContent).not.toContain('Brug billedet');
  });

  it('discards the draft when the sheet is closed without "Brug billedet"', async () => {
    await setup();
    await selectPhoto();

    host.querySelector<HTMLButtonElement>('.ui-sheet__close')?.click();
    await fixture.whenStable();

    expect(closed).toHaveBeenCalledOnce();
    expect(host.querySelector('.profile-photo-sheet__crop')).toBeNull();
    expect(photo()).toBeNull();
  });

  it('shows the saved photo and removes it in the API', async () => {
    TestBed.inject(UserProfileService).update({ photo: SAVED_PHOTO });
    await setup();
    expect(host.querySelector('app-profile-avatar')?.getAttribute('style')).toContain(
      DEV_IMAGE_URL,
    );

    await click('Fjern foto');
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'DELETE', url: PROFILE_IMAGE })
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(photo()).toBeNull();
    expect(host.textContent).not.toContain('Fjern foto');
  });
});
