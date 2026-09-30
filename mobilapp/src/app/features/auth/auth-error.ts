import { ApiError } from '../../core/models/api-error';

/**
 * Last resort if something other than an `ApiError` fails. `AuthApi` always fails with an
 * `ApiError`, so this text is practically never seen – but the user should never see a technical error.
 */
const FALLBACK_MESSAGE_KEY = 'auth.error.fallback';

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Partial<ApiError>).messageKey === 'string'
  );
}

/**
 * Translates an error from `AuthApi` into the translation key of a message that can be shown
 * directly to the user. Pages store the key, so a shown error follows a language switch.
 */
export function authErrorKey(error: unknown): string {
  return isApiError(error) ? error.messageKey : FALLBACK_MESSAGE_KEY;
}
