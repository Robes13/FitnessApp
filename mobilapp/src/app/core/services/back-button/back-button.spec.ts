import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BACK_BUTTON_PLATFORM, BackButtonPlatform, BackButtonService } from './back-button';

class FakeBackButton implements BackButtonPlatform {
  minimized = false;
  press: (canGoBack: boolean) => void = () => undefined;

  onBack(listener: (canGoBack: boolean) => void): void {
    this.press = listener;
  }

  minimize(): void {
    this.minimized = true;
  }
}

describe('BackButtonService', () => {
  let fake: FakeBackButton;
  let document: Document;

  beforeEach(() => {
    fake = new FakeBackButton();
    TestBed.configureTestingModule({
      providers: [{ provide: BACK_BUTTON_PLATFORM, useValue: fake }],
    });
    TestBed.inject(BackButtonService);
    document = TestBed.inject(DOCUMENT);
  });

  it('lets an open sheet handle back via Escape', () => {
    const closeSheet = (event: Event) => event.preventDefault();
    document.addEventListener('keydown', closeSheet);
    const back = vi.spyOn(history, 'back');

    fake.press(true);

    expect(back).not.toHaveBeenCalled();
    expect(fake.minimized).toBe(false);
    document.removeEventListener('keydown', closeSheet);
  });

  it('goes back in history when nothing is open', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);

    fake.press(true);

    expect(back).toHaveBeenCalledOnce();
    expect(fake.minimized).toBe(false);
  });

  it('minimizes the app when there is no history', () => {
    fake.press(false);

    expect(fake.minimized).toBe(true);
  });
});
