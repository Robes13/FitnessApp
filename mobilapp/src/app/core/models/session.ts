/**
 * `guest` – logged out. `pending-verification` – registered, but the e-mail isn't verified yet,
 * so there are no tokens. `authenticated` – tokens for the API.
 */
export type SessionStatus = 'guest' | 'pending-verification' | 'authenticated';

/** The tokens of `AuthResponse`. The timestamps are UTC ISO strings. */
export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface SessionState {
  status: SessionStatus;
  /** The account's e-mail – kept as a guest, so the login form can be prefilled. */
  email: string | null;
  /**
   * The account last registered or signed in on this device – kept as a guest, so a login with
   * another account can clear this one's local data first.
   */
  userId: number | null;
  /** Only while `authenticated`. */
  tokens: AuthTokens | null;
}
