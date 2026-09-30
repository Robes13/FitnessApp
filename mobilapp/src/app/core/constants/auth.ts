/** Translation keys of the auth layer's user-facing error messages. */
export const AUTH_ERROR_MESSAGE_KEY = {
  NO_BACKEND: 'core.auth.error.noBackend',
  INVALID_EMAIL: 'core.auth.error.invalidEmail',
  INVALID_CODE: 'core.auth.error.invalidCode',
  PASSWORD_TOO_SHORT: 'core.auth.error.passwordTooShort',
} as const;

/** Backend endpoints for auth, relative to the API's base URL. */
export const AUTH_ENDPOINT = {
  REGISTER: 'auth/register',
  RESEND_VERIFICATION: 'auth/verification/resend',
  VERIFICATION_STATUS: 'auth/verification/status',
} as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINT)[keyof typeof AUTH_ENDPOINT];
