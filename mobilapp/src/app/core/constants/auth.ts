/** Translation keys of the auth layer's user-facing error messages. */
export const AUTH_ERROR_MESSAGE_KEY = {
  INVALID_EMAIL: 'core.auth.error.invalidEmail',
  /** A verification or reset token that is malformed, used or expired. */
  INVALID_CODE: 'core.auth.error.invalidCode',
  PASSWORD_TOO_SHORT: 'core.auth.error.passwordTooShort',
  /** Login 401 – the API answers the same for a wrong password and an unverified e-mail. */
  INVALID_CREDENTIALS: 'core.auth.error.invalidCredentials',
  EMAIL_TAKEN: 'core.auth.error.emailTaken',
  USERNAME_TAKEN: 'core.auth.error.usernameTaken',
  REGISTER_FAILED: 'core.auth.error.registerFailed',
  /** "Check again" after an app restart: without the sign-up password there is nothing to check with. */
  VERIFICATION_UNCHECKABLE: 'core.auth.error.verificationUncheckable',
} as const;

/** Auth endpoints, relative to `API_BASE_URL`. */
export const AUTH_ENDPOINT = {
  REGISTER: 'auth/register',
  LOGIN: 'auth/login',
  REFRESH: 'auth/refresh',
  LOGOUT: 'auth/logout',
  VERIFY_EMAIL: 'auth/email/verify',
  RESEND_VERIFICATION: 'auth/email/resend-verification',
  FORGOT_PASSWORD: 'auth/password/forgot',
  RESET_PASSWORD: 'auth/password/reset',
} as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINT)[keyof typeof AUTH_ENDPOINT];

/** Called without a session: the auth interceptor neither adds a bearer nor refreshes for them. */
export const ANONYMOUS_AUTH_ENDPOINTS: readonly AuthEndpoint[] = [
  AUTH_ENDPOINT.REGISTER,
  AUTH_ENDPOINT.LOGIN,
  AUTH_ENDPOINT.REFRESH,
  AUTH_ENDPOINT.VERIFY_EMAIL,
  AUTH_ENDPOINT.RESEND_VERIFICATION,
  AUTH_ENDPOINT.FORGOT_PASSWORD,
  AUTH_ENDPOINT.RESET_PASSWORD,
];

/** The signed-in user's account (`GET`/`PATCH`/`DELETE`), relative to `API_BASE_URL`. */
export const ME_ENDPOINT = 'me';

/** The API's rules for a username (checked before trimming). */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;

/** Verification and reset tokens: 32 random bytes as upper-case hex, sent in a plain e-mail. */
export const AUTH_TOKEN_PATTERN = /^[0-9A-F]{64}$/;

/** The access token lives 15 minutes; it is refreshed this long before it expires. */
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
