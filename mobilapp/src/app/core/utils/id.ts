/**
 * Unikt id til en lokal post: `<prefix>-<uuid>`. Præfikset gør posten genkendelig i
 * storage og i fejlsøgning; `crypto.randomUUID()` står for at id'et er unikt.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
