/** The device's health store: Apple Health on iOS, Health Connect on Android. */
export type HealthSource = 'apple-health' | 'health-connect';

/**
 * The device's health store behind an interface, so specs can give a fake. Read access to steps
 * only – Nutrify never writes health data.
 */
export interface HealthPlatform {
  /** The store this platform would have; `null` in the browser. Says nothing about availability. */
  source(): HealthSource | null;
  /** False in the browser and on a device without the store (e.g. Health Connect not installed). */
  isAvailable(): Promise<boolean>;
  /** Shows the system's permission dialog when needed; `true` when steps may be read. */
  requestStepsAccess(): Promise<boolean>;
  /**
   * `true` when steps may be read – without asking. iOS never says whether reading was denied:
   * it answers `true` once the dialog has been shown, and a denied read then just has no data.
   */
  hasStepsAccess(): Promise<boolean>;
  /** The step total of each local day from `from` up to `to` (exclusive) that has steps. */
  dailyStepTotals(from: Date, to: Date): Promise<readonly number[]>;
}

/**
 * `StepSyncService.status`: the store's load state (`StoreStatus`), then how the latest sync
 * ended – `synced`, `insufficient` (too few days with steps), `no-permission` (the health store
 * denies reading steps) or `failed` (the health store or the API failed; retried next time).
 */
export type StepSyncStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'syncing'
  | 'synced'
  | 'insufficient'
  | 'no-permission'
  | 'failed';

/** The latest successful sync on this device, as stored. */
export interface StepSyncRecord {
  /** ISO timestamp. */
  readonly syncedAt: string;
  /** The daily average that was sent to the API. */
  readonly dailySteps: number;
}

/** The API's `ConsentType`. */
export type ApiConsentType = 'Terms' | 'HealthDataProcessing' | 'StepsIntegration';

/** One row of `GET me/consents`. `withdrawnAt` is `null` while the consent is active. */
export interface UserConsentDto {
  userConsentId: number;
  consentType: ApiConsentType;
  documentVersion: string;
  grantedAt: string;
  withdrawnAt: string | null;
}

/** Body of `POST me/consents`. 409 = the consent is already active. */
export interface GrantConsentRequest {
  consentType: ApiConsentType;
  documentVersion: string;
}

/**
 * Body of `PUT me/profile/activity`. `fromHealthIntegration: true` needs an active
 * `StepsIntegration` consent (403 without). The API recalculates the goal.
 */
export interface UpdateActivityRequest {
  dailySteps: number;
  fromHealthIntegration: boolean;
}
