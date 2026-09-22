import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { STORAGE_KEY } from '../constants/storage-key';
import { FakeStorage, createFakeStorage } from '../testing/fake-document';
import { provideCoreTestEnvironment } from '../testing/test-providers';
import { authGuard, guestGuard } from './auth.guard';

const ROUTE = {} as ActivatedRouteSnapshot;
const STATE = {} as RouterStateSnapshot;

describe('route guards', () => {
  let storage: FakeStorage;

  function setup(loggedIn: boolean): Router {
    storage = createFakeStorage();
    storage.setItem(
      STORAGE_KEY.SESSION,
      JSON.stringify({ isLoggedIn: loggedIn, isEmailVerified: loggedIn }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([]), ...provideCoreTestEnvironment({ storage })],
    });
    return TestBed.inject(Router);
  }

  function redirectOf(result: unknown, router: Router): string | null {
    return result instanceof UrlTree ? router.serializeUrl(result) : null;
  }

  describe('authGuard', () => {
    it('allows logged-in users', () => {
      setup(true);

      expect(TestBed.runInInjectionContext(() => authGuard(ROUTE, STATE))).toBe(true);
    });

    it('redirects guests to login', () => {
      const router = setup(false);

      const result = TestBed.runInInjectionContext(() => authGuard(ROUTE, STATE));

      expect(redirectOf(result, router)).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('allows guests', () => {
      setup(false);

      expect(TestBed.runInInjectionContext(() => guestGuard(ROUTE, STATE))).toBe(true);
    });

    it('redirects logged-in users home', () => {
      const router = setup(true);

      const result = TestBed.runInInjectionContext(() => guestGuard(ROUTE, STATE));

      expect(redirectOf(result, router)).toBe('/hjem');
    });
  });
});
