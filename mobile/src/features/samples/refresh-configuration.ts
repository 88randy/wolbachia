interface Dependencies {
  readonly refreshCatalog: () => Promise<void>;
  readonly refreshBootstrap: (force: boolean) => Promise<void>;
}

/** Explicit recovery upgrades the real catalog before requesting the current complete frame. */
export async function refreshSampleConfiguration(deps: Dependencies, isCurrent: () => boolean) {
  if (!isCurrent()) return;
  await deps.refreshCatalog();
  if (!isCurrent()) return;
  await deps.refreshBootstrap(true);
}
