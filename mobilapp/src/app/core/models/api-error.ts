/** An error from the backend. `messageKey` is a translation key for a message the user can read. */
export interface ApiError {
  messageKey: string;
  /** The HTTP status, `0` when the request never reached the server. Absent for local errors. */
  status?: number;
}
