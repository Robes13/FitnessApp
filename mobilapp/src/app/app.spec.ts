import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { APP_PATH } from './core/constants/app-route';
import { STORAGE_KEY } from './core/constants/storage-key';
import { AUTHENTICATED_SESSION } from './core/testing/fixtures';

describe('App', () => {
  it('renders a router outlet as its only content', async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    expect(host.classList.contains('app-root')).toBe(true);
    expect(host.querySelector('router-outlet')).not.toBeNull();
    expect(host.children.length).toBe(1);
  });
});

describe('routes', () => {
  // The router's test harness requires the real (jsdom) document, so the session is seeded
  // directly into `localStorage`, which `StorageService` reads via `DOCUMENT.defaultView`.
  afterEach(() => localStorage.clear());

  async function navigate(loggedIn: boolean, url: string): Promise<string> {
    localStorage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify(loggedIn ? AUTHENTICATED_SESSION : null),
    );
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return TestBed.inject(Router).url;
  }

  it('sends a logged-in user from the root to Hjem', async () => {
    expect(await navigate(true, '/')).toBe(APP_PATH.HOME);
  });

  it('sends unknown paths to Hjem', async () => {
    expect(await navigate(true, '/findes-ikke')).toBe(APP_PATH.HOME);
  });

  it('keeps logged-in users away from login', async () => {
    expect(await navigate(true, APP_PATH.LOGIN)).toBe(APP_PATH.HOME);
  });

  it('sends guests from the tabs to login', async () => {
    expect(await navigate(false, APP_PATH.HOME)).toBe(APP_PATH.LOGIN);
  });

  it('sends guests from Profil to login', async () => {
    expect(await navigate(false, APP_PATH.PROFILE)).toBe(APP_PATH.LOGIN);
  });

  it('lets guests open Opret konto', async () => {
    expect(await navigate(false, APP_PATH.SIGNUP)).toBe(APP_PATH.SIGNUP);
  });

  it('lets guests open Glemt adgangskode', async () => {
    expect(await navigate(false, APP_PATH.FORGOT_PASSWORD)).toBe(APP_PATH.FORGOT_PASSWORD);
  });
});
