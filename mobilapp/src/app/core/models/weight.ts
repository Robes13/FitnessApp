export interface WeighEntry {
  id: string;
  kg: number;
  /** ISO-datotid for vejningen. */
  at: string;
}

export type WeightRange = '1u' | '4u' | '3m';

export interface WeightPoint {
  kg: number;
  /** ISO-datotid for punktet. */
  at: string;
}
