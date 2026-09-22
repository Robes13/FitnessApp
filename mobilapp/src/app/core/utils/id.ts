/**
 * Unique id for a local record: `<prefix>-<uuid>`. The prefix makes the record recognizable
 * in storage and while debugging; `crypto.randomUUID()` takes care of uniqueness.
 */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
