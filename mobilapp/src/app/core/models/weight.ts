export interface WeighEntry {
  id: string;
  kg: number;
  /** ISO-datotid for vejningen. */
  at: string;
}

export type WeightRange = '1u' | '3u' | '3m';

export interface WeightPoint {
  kg: number;
  /** ISO-datotid for punktet. */
  at: string;
  /** Where the point sits on the range's time axis: 0 = the range's start, 1 = now. */
  position: number;
}

/** A weigh-in as the API sends it (`GET`/`POST`/`PATCH me/weight-logs`, the history payload). */
export interface WeightLogDto {
  weightLogId: number;
  /** kg. */
  weight: number;
  /** UTC timestamp. */
  recordedAt: string;
  /** `YYYY-MM-DD` – the calendar day in the profile's time zone. */
  recordedDate: string;
}

/** Body of `POST me/weight-logs`. 409 when the profile's calendar day already has a weigh-in. */
export interface CreateWeightLogRequest {
  weight: number;
  recordedAt: string;
}

/** Body of `PATCH me/weight-logs/{id}`; without `recordedAt` the time stays. */
export interface UpdateWeightLogRequest {
  weight: number;
  recordedAt?: string;
}

/**
 * `WeightLogService.add()`: saved, or the day already has a weigh-in (`id`) – the screen then
 * asks whether to overwrite it (spec 6.0-4a). Nothing is overwritten automatically.
 */
export type WeightSaveResult =
  { kind: 'saved'; entry: WeighEntry } | { kind: 'exists'; id: string };
