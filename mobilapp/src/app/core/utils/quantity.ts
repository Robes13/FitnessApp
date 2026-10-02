import { COUNTED_UNIT_LABEL_KEY } from '../constants/food';
import { Translate } from '../services/language/translate';

/** `'2 portion'` → amount `'2'`, unit `'portion'`. */
const QUANTITY_PATTERN = /^(\d+(?:[.,]\d+)?)\s+(\S.*)$/;

/**
 * The unit as shown after `amount`: a counted unit in the active language and number
 * (`'portion'` → `'portion'` for 1, `'portioner'` otherwise); any other token as it is (`'g'`).
 */
export function formatQuantityUnit(t: Translate, unit: string, amount: number): string {
  const keys = COUNTED_UNIT_LABEL_KEY[unit];
  if (!keys) {
    return unit;
  }
  return t(amount === 1 ? keys.one : keys.other);
}

/**
 * A `FoodItem.quantity` as shown: `'2 portion'` → `'2 portioner'` (`'2 servings'`), `'150 g'`
 * unchanged. The quantity itself keeps the token – it's data that `parseQuantity` reads back.
 */
export function formatQuantity(t: Translate, quantity: string): string {
  const match = QUANTITY_PATTERN.exec(quantity.trim());
  const amount = match?.[1];
  const unit = match?.[2];
  if (amount === undefined || unit === undefined) {
    return quantity;
  }
  return `${amount} ${formatQuantityUnit(t, unit, Number(amount.replace(',', '.')))}`;
}
