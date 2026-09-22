import { UserProfile } from './profile';

/** Body of `POST AUTH_ENDPOINT.REGISTER`. The photo is never part of a sign-up. */
export interface RegisterRequest {
  password: string;
  profile: Omit<UserProfile, 'photo'>;
}

/** Response of `GET AUTH_ENDPOINT.VERIFICATION_STATUS`. */
export interface VerificationStatusResponse {
  verified: boolean;
}
