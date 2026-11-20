/** Client compresses to JPEG data-URL under this char length. */
export const MAX_PHOTO_CHARS = 350_000;

/** Optional company / mission reference photos. */
export const MAX_REF_PHOTO_CHARS = 280_000;

/** Soft quota of stored data-URL characters per event (~40MB). */
export const MAX_EVENT_UPLOAD_CHARS = 40_000_000;

export const MAX_SUBMISSIONS_PER_EVENT = 400;
export const MAX_GUESTS_PER_EVENT = 250;
export const MAX_MISSIONS = 5;
export const MIN_MISSIONS = 5;
export const MAX_EVENTS_GLOBAL = 300;
/** Hunts untouched this long are deleted with their photos (keeps the server from filling up). */
export const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const BODY_CREATE_MAX = 1_600_000;
export const BODY_SUBMIT_MAX = 420_000;
export const BODY_HOST_MAX = 1_600_000;
