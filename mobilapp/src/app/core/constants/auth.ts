/** Brugerrettede fejltekster fra auth-laget. */
export const AUTH_ERROR_MESSAGE = {
  NO_BACKEND: 'Der er ingen forbindelse til en server endnu.',
  INVALID_EMAIL: 'Skriv en gyldig e-mail.',
  INVALID_CODE: 'Koden er 4 cifre.',
  PASSWORD_TOO_SHORT: 'Mindst 8 tegn.',
} as const;

/** Backend endpoints for auth, relative to the API's base URL. */
export const AUTH_ENDPOINT = {
  REGISTER: 'auth/register',
  RESEND_VERIFICATION: 'auth/verification/resend',
  VERIFICATION_STATUS: 'auth/verification/status',
} as const;

export type AuthEndpoint = (typeof AUTH_ENDPOINT)[keyof typeof AUTH_ENDPOINT];
