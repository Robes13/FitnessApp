import { InjectionToken } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AggregatedSample, AuthorizationOptions, Health } from '@capgo/capacitor-health';
import { HealthPlatform, HealthSource } from '../../models/step-sync';
import { toIsoDate } from '../../utils/date-format';

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

  /** Day buckets from `from`, summed per local day (`totalsByLocalDay`). */
  async dailyStepTotals(from: Date, to: Date): Promise<readonly number[]> {
    const { samples } = await Health.queryAggregated({
      dataType: STEPS,
      startDate: from.toISOString(),
      endDate: to.toISOString(),
      bucket: 'day',
      aggregation: 'sum',
    });
    return totalsByLocalDay(samples);
  }

  openSettings(): Promise<void> {
    return Health.openHealthConnectSettings();
  }
}

/**
 * The buckets' sums per local day of each bucket's midpoint; days without steps have no bucket.
 * HealthKit's day buckets are calendar days. Health Connect slices fixed 24 hours from `from` (a
 * local midnight), so after a DST switch they run 23–23 or 01–01, and across the autumn switch the
 * window ends in an extra one-hour slice – part of the last day, not a day of its own.
 */
export function totalsByLocalDay(
  samples: readonly Pick<AggregatedSample, 'startDate' | 'endDate' | 'value'>[],
): number[] {
  const byDay = new Map<string, number>();
  for (const sample of samples) {
    const midpoint = (Date.parse(sample.startDate) + Date.parse(sample.endDate)) / 2;
    const day = toIsoDate(new Date(midpoint));
    byDay.set(day, (byDay.get(day) ?? 0) + sample.value);
  }
  return [...byDay.values()];
}

/** The device's health store. Specs provide a fake. */
export const HEALTH_PLATFORM = new InjectionToken<HealthPlatform>('HEALTH_PLATFORM', {
  providedIn: 'root',
  factory: () => new CapacitorHealthPlatform(),
});
