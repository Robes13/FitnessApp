import { HttpTestingController } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { createFakeDocument } from '../../../core/testing/fake-document';
import { provideCoreTestEnvironment } from '../../../core/testing/test-providers';
import { PrivacyService } from './privacy';

const TOKEN_URL = '/api/v1/me/data-export/token';

describe('PrivacyService', () => {
  let assign: ReturnType<typeof vi.fn<(url: string) => void>>;
  let http: HttpTestingController;
  let privacy: PrivacyService;

  beforeEach(() => {
    assign = vi.fn<(url: string) => void>();
    TestBed.configureTestingModule({
      providers: [
        ...provideCoreTestEnvironment(),
        { provide: DOCUMENT, useValue: { ...createFakeDocument(), location: { assign } } },
        PrivacyService,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    privacy = TestBed.inject(PrivacyService);
  });

  afterEach(() => {
    http.verify();
  });

  it('downloads the export with the token in the query string, URL-encoded', async () => {
    const done = firstValueFrom(privacy.downloadMyData(), { defaultValue: undefined });
    const request = http.expectOne({ method: 'POST', url: TOKEN_URL });
    expect(assign).not.toHaveBeenCalled();
    request.flush({ token: 'a+b/c=' });
    await done;

    expect(assign).toHaveBeenCalledExactlyOnceWith('/api/v1/data-export?token=a%2Bb%2Fc%3D');
  });

  it('fails with an ApiError and downloads nothing when no token is issued', async () => {
    const done = firstValueFrom(privacy.downloadMyData());
    http.expectOne(TOKEN_URL).error(new ProgressEvent('error'));

    await expect(done).rejects.toEqual({ messageKey: 'common.error.network', status: 0 });
    expect(assign).not.toHaveBeenCalled();
  });
});
