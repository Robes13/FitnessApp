/** A page of a keyset-paginated list (`?limit=&cursor=`), newest first. */
export interface CursorPage<T> {
  items: T[];
  /** Pass back verbatim as `cursor` for the next page; `null` on the last page. */
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * An error body of the API. A thrown business error (`application/json`) has `title`, `status`
 * and `detail`; `NotFound()` (`application/problem+json`) has no `detail`; a model-binding error
 * (`application/problem+json`) has `errors`: C# property names or JSON paths (`"$.gender"`) →
 * messages. `detail` is English and meant for developers – map it to a translation key, never
 * show it.
 */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}
