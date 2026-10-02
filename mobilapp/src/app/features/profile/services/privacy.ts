import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { DATA_EXPORT_ENDPOINT } from '../../../core/constants/auth';
import { AuthApi } from '../../../core/services/auth-api/auth-api';
import { injectApiUrl, mapApiError } from '../../../core/utils/api';

/**
 * "Download mine data" (spec 9.1). Provided by the profile page.
 *
 * Capacitor's WebViews can't save a blob, so the app asks for a short-lived token
 * (`POST me/data-export/token`, 5 minutes) and navigates to the anonymous
 * `GET data-export?token=…`, which answers with a JSON attachment: the browser downloads it and
 * the app stays where it is; on a phone, Capacitor opens the system browser, which saves the file.
 * The token goes in the query string – never in the path, which the API logs on a server error.
 */
@Injectable()
export class PrivacyService {
  private readonly authApi = inject(AuthApi);
  private readonly document = inject(DOCUMENT);
  private readonly apiUrl = injectApiUrl();

  /** Completes once the download has been handed to the browser. Fails with an `ApiError`. */
  downloadMyData(): Observable<void> {
    return this.authApi.createDataExportToken().pipe(
      tap(({ token }) =>
        this.document.location.assign(
          this.apiUrl(`${DATA_EXPORT_ENDPOINT}?token=${encodeURIComponent(token)}`),
        ),
      ),
      map(() => undefined),
      mapApiError(),
    );
  }
}
