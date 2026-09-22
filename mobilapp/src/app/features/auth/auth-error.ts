import { ApiError } from '../../core/models/api-error';

/**
 * Last resort if something other than an `ApiError` fails. `AuthApi` always fails with an
 * `ApiError`, so this text is practically never seen – but the user should never see a technical error.
 */
const FALLBACK_MESSAGE = 'Noget gik galt. Prøv igen.';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Partial<ApiError>).message === 'string'
  );
}

/** Translates an error from `AuthApi` into a Danish message that can be shown directly to the user. */
export function authErrorMessage(error: unknown): string {
  return isApiError(error) ? error.message : FALLBACK_MESSAGE;
}
