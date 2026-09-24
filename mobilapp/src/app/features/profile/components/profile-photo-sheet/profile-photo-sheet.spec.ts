import { TestBed } from '@angular/core/testing';
import { STORAGE_KEY } from '../../../../core/constants/storage-key';
import { UserProfileService } from '../../../../core/services/user-profile/user-profile';
import {
  provideComponentTestEnvironment,
  resetComponentTestStorage,
} from '../../../../core/testing/test-providers';
import { ProfilePhotoSheet } from './profile-photo-sheet';

async function selectPhoto(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ProfilePhotoSheet);
  fixture.componentRef.setInput('open', true);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const input = root.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new File(['photo'], 'photo.jpg')] });
  input.dispatchEvent(new Event('change'));
  await fixture.whenStable();
  return root;
}

describe('ProfilePhotoSheet image persistence', () => {
  const drawImage = vi.fn();
  beforeEach(() => {
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
        set src(_value: string) {
          this.onload();
        }
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,small',
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stores a resized image instead of the original file', async () => {
    await selectPhoto();
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 768, 512);
    expect(TestBed.inject(UserProfileService).profile().photo?.dataUrl).toBe(
      'data:image/jpeg;base64,small',
    );
    expect(window.localStorage.getItem(STORAGE_KEY.PROFILE)).toContain('base64,small');
  });

  it('shows storage failure and preserves the previous profile', async () => {
    const profiles = TestBed.inject(UserProfileService);
    profiles.update({ username: 'Before' });
    const previous = profiles.profile();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const root = await selectPhoto();
    expect(root.textContent).toContain('Billedet kunne ikke gemmes');
    expect(profiles.profile()).toBe(previous);
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY.PROFILE)!)).toEqual(previous);
  });
});
