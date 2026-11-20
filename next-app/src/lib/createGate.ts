/**
 * Hunt creation is open: anyone with the app link can create a hunt.
 * (The old EVENT_CREATE_SECRET password was removed on request.)
 * Abuse is bounded by the create rate limit and automatic cleanup of old hunts.
 */
export function assertCanCreateEvent(): void {
  // intentionally open
}
