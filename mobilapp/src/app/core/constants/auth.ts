/** Translation keys of the auth layer's user-facing error messages. */
export const AUTH_ERROR_MESSAGE_KEY = {
  INVALID_EMAIL: 'core.auth.error.invalidEmail',
  PASSWORD_TOO_SHORT: 'core.auth.error.passwordTooShort',
  /** Login 401 – the API doesn't say whether the identifier or the password is wrong. */
  INVALID_CREDENTIALS: 'core.auth.error.invalidCredentials',
  /** Login 429 – the account is locked for the rest of its 15-minute window. */
  TOO_MANY_ATTEMPTS: 'core.auth.error.tooManyAttempts',
  EMAIL_TAKEN: 'core.auth.error.emailTaken',
  USERNAME_TAKEN: 'core.auth.error.usernameTaken',
  REGISTER_FAILED: 'core.auth.error.registerFailed',
} as const;

/** Auth endpoints, relative to `API_BASE_URL`. */
export const AUTH_ENDPOINT = {
  REGISTER: 'auth/register',
  LOGIN: 'auth/login',
  REFRESH: 'auth/refresh',
  LOGOUT: 'auth/logout',
  RESEND_VERIFICATION: 'auth/email/resend-verification',
  FORGOT_PASSWORD: 'auth/password/forgot',
} as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINT)[keyof typeof AUTH_ENDPOINT];

/** Called without a session: the auth interceptor neither adds a bearer nor refreshes for them. */
export const ANONYMOUS_AUTH_ENDPOINTS: readonly AuthEndpoint[] = [
  AUTH_ENDPOINT.REGISTER,
  AUTH_ENDPOINT.LOGIN,
  AUTH_ENDPOINT.REFRESH,
  AUTH_ENDPOINT.RESEND_VERIFICATION,
  AUTH_ENDPOINT.FORGOT_PASSWORD,
];

/** The signed-in user's account (`GET`/`PATCH`/`DELETE`), relative to `API_BASE_URL`. */
export const ME_ENDPOINT = 'me';

/** `POST`: a short-lived (5 min) token for downloading the user's data export (GDPR). */
export const DATA_EXPORT_TOKEN_ENDPOINT = 'me/data-export/token';

/**
 * `GET ?token=…` (anonymous): the data export as a JSON attachment. The token goes in the query
 * string, never in the path – the API logs the path of a failed request.
 */
export const DATA_EXPORT_ENDPOINT = 'data-export';

/** `POST`: withdraws the consent to the terms, which deletes and anonymises the account. */
export const WITHDRAW_TERMS_CONSENT_ENDPOINT = 'me/consents/Terms/withdraw';

/** The API's longest username (`UsernameRules`); the value is checked as typed, untrimmed. */
export const USERNAME_MAX_LENGTH = 50;

/**
 * 3–50 ASCII letters, digits, `-` and `_` (the API's `UsernameRules.Pattern`). No `@` either: login
 * tells an e-mail from a username by it. Usernames are case-insensitive at login.
 */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,50}$/;

/** The login field takes an e-mail or a username; the API accepts at most 320 characters. */
export const LOGIN_IDENTIFIER_MAX_LENGTH = 320;

/** How often the open verification sheet tries to log in (the API has no status endpoint). */
export const VERIFICATION_POLL_MS = 5_000;

/** The access token lives 15 minutes; it is refreshed this long before it expires. */
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
