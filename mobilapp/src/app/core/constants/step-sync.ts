import { ApiConsentType, HealthSource } from '../models/step-sync';

/** Consent endpoints for the step sync, relative to `API_BASE_URL`. */
export const STEP_SYNC_ENDPOINT = {
  /** `GET ?limit=` (a `CursorPage`, newest first) and `POST` a new consent. */
  CONSENTS: 'me/consents',
  /** `POST`: 204, or 404 when no such consent is active. Doesn't delete the account. */
  WITHDRAW: 'me/consents/StepsIntegration/withdraw',
} as const;

export const STEPS_CONSENT_TYPE: ApiConsentType = 'StepsIntegration';
/** The version of the explanation the user agrees to (the profile row's text). */
export const STEPS_CONSENT_DOCUMENT_VERSION = '1';
/**
 * One page is enough: the only other consent is `Terms` from the sign-up, so the newest
 * `StepsIntegration` row – the active one, if any – is always on it.
 */
export const CONSENT_PAGE_LIMIT = 50;

/** Spec 2.6 "once a month": a sync is due this many days after the last successful one. */
export const STEP_SYNC_INTERVAL_DAYS = 30;
/** The average covers this many full days before today. */
export const STEP_SYNC_WINDOW_DAYS = 30;
/** Fewer days with steps than this is too little to say anything (no update). */
export const STEP_SYNC_MIN_DAYS = 7;

/** The health store's name, for "Skridt fra {{source}}". */
export const HEALTH_SOURCE_NAME_KEY: Readonly<Record<HealthSource, string>> = {
  'apple-health': 'core.stepSync.source.appleHealth',
  'health-connect': 'core.stepSync.source.healthConnect',
};

/** Translation keys of the step sync's status texts. */
export const STEP_SYNC_TEXT_KEY = {
  SYNCING: 'core.stepSync.syncing',
  /** `{{day}}`, `{{steps}}`. */
  SYNCED: 'core.stepSync.synced',
  /** `{{minDays}}`, `{{days}}`. */
  INSUFFICIENT: 'core.stepSync.insufficient',
  /** `{{source}}`. */
  NO_PERMISSION: 'core.stepSync.noPermission',
  /** Also shown on Home, so a user who doesn't open Profile hears of it. */
  FAILED: 'core.stepSync.failed',
  /** `enable()` answered `false`: the user didn't allow reading steps. */
  ACCESS_DENIED: 'core.stepSync.accessDenied',
} as const;
