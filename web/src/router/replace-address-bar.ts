/**
 * Rewrites the address bar WITHOUT telling the router. `@tanstack/history` wraps the instance
 * method `window.history.replaceState` (dist/esm/index.js) and notifies the router, which would
 * navigate to `url` as if it were a route. Calling the prototype method skips that wrapper. This
 * relies on that implementation detail; if the library stops patching the instance, the call is
 * still correct. Route masking is not used because it keeps the original URL (the reset token)
 * in `history.state`.
 */
export function replaceAddressBar(url: string): void {
  History.prototype.replaceState.call(window.history, window.history.state, "", url);
}
