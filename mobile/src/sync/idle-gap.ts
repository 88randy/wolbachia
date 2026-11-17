/**
 * [ASSUMPTION] Technical floor between sync passes nobody asked for: an idle phone (nothing new in
 * the outbox, no pull by the person) asks the server at most once a minute. A new event, "Intentar
 * ahora", a reconnect and a sign-in still start a pass at once.
 */
export const IDLE_SYNC_GAP_MS = 60_000;
