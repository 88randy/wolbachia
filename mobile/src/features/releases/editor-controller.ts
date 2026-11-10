import type { MessageKey } from "@wolbachia/i18n";
import type { ReleaseService } from "./service.ts";
import type { ReleaseSelection, ReleaseState } from "./types.ts";
import type { ReleaseEditBuffer } from "./edit-buffer.ts";
import { releaseErrorKey } from "./release-error-key.ts";

type Unsubscribe = () => void;
interface Dependencies {
  readonly service: Pick<
    ReleaseService,
    "read" | "begin" | "edit" | "save" | "locate" | "photo" | "undoPhoto" | "subscribe"
  >;
  readonly selection: ReleaseSelection;
  readonly buffer: ReleaseEditBuffer;
  readonly refreshBundle: () => Promise<void>;
  readonly identityKey: () => string | null;
  readonly isUnlocked: () => boolean;
  readonly subscribeScope: (listener: () => void) => Unsubscribe;
  readonly subscribeAuth: (listener: () => void) => Unsubscribe;
  readonly subscribeSync: (listener: () => void) => Unsubscribe;
}
export interface ReleaseEditorSnapshot {
  readonly selection: ReleaseSelection;
  readonly state: ReleaseState | null;
  readonly isBusy: boolean;
  readonly errorKey: MessageKey | null;
  readonly touchedId: string | null;
}
interface ReadLease {
  readonly request: number;
  readonly epoch: number;
  readonly revision: number;
  readonly identity: string;
  readonly selection: string;
}
function selectionKey(selection: ReleaseSelection): string {
  return JSON.stringify([selection.taskId, selection.deviceId, selection.manualCapture]);
}
/** Synchronous scope invalidation and one local edit buffer fence all asynchronous UI continuations. */
export class ReleaseEditorController {
  readonly #deps: Dependencies;
  readonly #listeners = new Set<() => void>();
  #snapshot: ReleaseEditorSnapshot;
  #stops: readonly Unsubscribe[] = [];
  #isActive = false;
  #epoch = 0;
  #request = 0;
  #identity: string | null;
  #contextDraftId: string | undefined;
  constructor(deps: Dependencies) {
    this.#deps = deps;
    this.#identity = deps.identityKey();
    this.#snapshot = {
      selection: deps.selection,
      state: null,
      isBusy: false,
      errorKey: null,
      touchedId: null,
    };
  }
  getSnapshot = (): ReleaseEditorSnapshot => this.#snapshot;
  subscribe = (listener: () => void): Unsubscribe => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #publish(patch: Partial<ReleaseEditorSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }
  start(): void {
    if (this.#isActive) return;
    this.#isActive = true;
    const reload = () => {
      void this.load();
    };
    const invalidate = () => {
      void this.load(true);
    };
    this.#stops = [
      this.#deps.service.subscribe(reload),
      this.#deps.subscribeScope(invalidate),
      this.#deps.subscribeAuth(() => {
        this.#authChanged();
      }),
      this.#deps.subscribeSync(reload),
    ];
    void this.load(true);
  }
  stop(): void {
    this.#isActive = false;
    this.#epoch++;
    this.#request++;
    for (const stop of this.#stops) stop();
    this.#stops = [];
  }
  #readLease(identity: string): ReadLease {
    return {
      identity,
      request: ++this.#request,
      epoch: this.#epoch,
      revision: this.#deps.buffer.revision,
      selection: selectionKey(this.#snapshot.selection),
    };
  }
  #isCurrentRead(lease: ReadLease): boolean {
    return (
      this.#isActive &&
      this.#deps.isUnlocked() &&
      lease.request === this.#request &&
      lease.epoch === this.#epoch &&
      lease.revision === this.#deps.buffer.revision &&
      lease.identity === this.#deps.identityKey() &&
      lease.selection === selectionKey(this.#snapshot.selection)
    );
  }
  #authChanged(): void {
    const identity = this.#deps.identityKey();
    if (identity !== this.#identity) {
      this.#identity = identity;
      void this.load(true);
      return;
    }
    this.#request++;
    this.#publish({ state: null });
    if (this.#deps.isUnlocked()) void this.load();
  }
  async load(shouldInvalidate = false): Promise<void> {
    if (!this.#isActive) return;
    if (shouldInvalidate) {
      this.#epoch++;
      this.#contextDraftId = undefined;
      this.#publish({ state: null, errorKey: null });
    }
    const identity = this.#deps.identityKey();
    if (identity === null || !this.#deps.isUnlocked()) {
      this.#publish({ state: null });
      return;
    }
    const lease = this.#readLease(identity);
    try {
      const state = await this.#deps.service.read(this.#snapshot.selection);
      if (this.#isCurrentRead(lease)) {
        this.#contextDraftId = state.draft?.eventId;
        this.#publish({ state: this.#deps.buffer.merge(state) });
      }
    } catch (error) {
      if (this.#isCurrentRead(lease)) this.#publish({ errorKey: releaseErrorKey(error) });
    }
  }
  #lease(eventId?: string, allowLocked = false): () => boolean {
    const identity = this.#deps.identityKey(),
      epoch = this.#epoch;
    const selection = selectionKey(this.#snapshot.selection);
    return () =>
      this.#isActive &&
      (allowLocked || this.#deps.isUnlocked()) &&
      identity !== null &&
      identity === this.#deps.identityKey() &&
      epoch === this.#epoch &&
      selection === selectionKey(this.#snapshot.selection) &&
      (eventId === undefined || this.#contextDraftId === eventId);
  }
  async #operate(
    action: (isCurrent: () => boolean) => Promise<unknown>,
    allowLocked = false,
  ): Promise<void> {
    if (!this.#canOperate()) return;
    const eventId = this.#snapshot.state?.draft?.eventId,
      isCurrent = this.#lease(eventId, allowLocked);
    this.#publish({ isBusy: true, errorKey: null });
    try {
      if (eventId !== undefined) await this.#deps.buffer.persist(eventId);
      if (!isCurrent()) return;
      await action(isCurrent);
      if (isCurrent()) await this.load();
    } catch (error) {
      if (isCurrent()) this.#publish({ errorKey: releaseErrorKey(error) });
    } finally {
      this.#finishOperation();
    }
  }
  #canOperate(): boolean {
    return this.#isActive && !this.#snapshot.isBusy && this.#deps.isUnlocked();
  }
  #finishOperation(): void {
    if (this.#isActive) this.#publish({ isBusy: false });
  }
  choose(field: "taskId" | "deviceId", id: string): void {
    void this.#operate(async () => {
      const selection = { ...this.#snapshot.selection, [field]: id };
      this.#epoch++;
      this.#contextDraftId = undefined;
      this.#publish({ selection, state: null, touchedId: null });
      await this.load();
    });
  }
  begin = (): void => {
    void this.#operate(() => this.#deps.service.begin(this.#snapshot.selection));
  };
  editQuantity = (quantity: string): void => {
    const state = this.#snapshot.state,
      draft = state?.draft;
    if (!state?.ready || !draft || state.event || this.#snapshot.isBusy) return;
    const isCurrent = this.#lease(draft.eventId);
    if (!isCurrent()) return;
    this.#deps.buffer.edit(draft.eventId, quantity, () =>
      this.#deps.service.edit(draft.eventId, quantity),
    );
    this.#publish({ state: this.#deps.buffer.merge(state) });
    void this.#deps.buffer
      .persist(draft.eventId)
      .then(() => {
        if (isCurrent()) this.#publish({ errorKey: null });
        return this.load();
      })
      .catch((error: unknown) => {
        if (isCurrent()) this.#publish({ errorKey: releaseErrorKey(error) });
      });
  };
  blurQuantity = (): void => {
    this.#publish({ touchedId: this.#snapshot.state?.draft?.eventId ?? null });
  };
  #capture(
    action: (id: string, isCurrent: () => boolean) => Promise<void>,
    allowLocked = false,
  ): void {
    const id = this.#snapshot.state?.draft?.eventId;
    if (id !== undefined) void this.#operate((isCurrent) => action(id, isCurrent), allowLocked);
  }
  save = (): void => {
    this.#capture((id, isCurrent) => this.#deps.service.save(id, isCurrent));
  };
  locate = (): void => {
    this.#capture((id, isCurrent) => this.#deps.service.locate(id, isCurrent));
  };
  photo = (): void => {
    this.#capture((id, isCurrent) => this.#deps.service.photo(id, isCurrent), true);
  };
  undoPhoto = (): void => {
    this.#capture((id) => this.#deps.service.undoPhoto(id));
  };
  retry = (): void => {
    void this.#operate(() => this.#deps.refreshBundle());
  };
  hasPending(): boolean {
    return this.#deps.buffer.hasPending(this.#snapshot.state?.draft?.eventId);
  }
}
