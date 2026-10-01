import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AuthorizationOptions, Health } from '@capgo/capacitor-health';
import { HealthPlatform, HealthSource } from '../../models/step-sync';

/** The plugin's name in the native bridge (`Capacitor.isPluginAvailable`). */
const PLUGIN_NAME = 'Health';
const STEPS = 'steps';
const READ_STEPS: AuthorizationOptions = { read: [STEPS] };
const SOURCE_BY_PLATFORM: Readonly<Record<string, HealthSource>> = {
  ios: 'apple-health',
  android: 'health-connect',
};

/**
 * `@capgo/capacitor-health`: HealthKit on iOS, Health Connect on Android. Unavailable in the
 * browser. Only reads steps; nothing is written.
 */
export class CapacitorHealthPlatform implements HealthPlatform {
  source(): HealthSource | null {
    return SOURCE_BY_PLATFORM[Capacitor.getPlatform()] ?? null;
  }

  async isAvailable(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable(PLUGIN_NAME)) {
      return false;
    }
    return (await Health.isAvailable()).available;
  }

  async requestStepsAccess(): Promise<boolean> {
    return (await Health.requestAuthorization(READ_STEPS)).readAuthorized.includes(STEPS);
  }

  async hasStepsAccess(): Promise<boolean> {
    return (await Health.checkAuthorization(READ_STEPS)).readAuthorized.includes(STEPS);
  }

  /**
   * Day buckets from `from`: HealthKit anchors them at local midnight, Health Connect slices 24-hour
   * periods from `from` (a local midnight) – off by an hour across a DST switch, which an average
   * of 30 days doesn't feel. Days without steps have no bucket.
   */
  async dailyStepTotals(from: Date, to: Date): Promise<readonly number[]> {
    const { samples } = await Health.queryAggregated({
      dataType: STEPS,
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    });
    return samples.map((sample) => sample.value);
  }
}

/** The device's health store. Specs provide a fake. */
export const HEALTH_PLATFORM = new InjectionToken<HealthPlatform>('HEALTH_PLATFORM', {
  providedIn: 'root',
  factory: () => new CapacitorHealthPlatform(),
});
