import type { MessageKey } from "@wolbachia/i18n";
import { ShiftBlockedError } from "../ovitrap-check/shift-authorization.ts";
import type { SampleService } from "./service.ts";
import type { SamplePatch, SampleSelection, SampleState } from "./types.ts";
import type { SampleEditBuffer } from "./edit-buffer.ts";

type Unsubscribe = () => void;
interface Dependencies {
  readonly service: Pick<
    SampleService,
    "read" | "begin" | "edit" | "save" | "locate" | "photo" | "undoPhoto" | "subscribe"
  >;
  readonly selection: SampleSelection;
  readonly buffer: SampleEditBuffer;
  readonly refreshBundle: (isCurrent: () => boolean) => Promise<void>;
  readonly identityKey: () => string | null;
  readonly isUnlocked: () => boolean;
  readonly subscribeScope: (listener: () => void) => Unsubscribe;
  readonly subscribeAuth: (listener: () => void) => Unsubscribe;
  readonly subscribeSync: (listener: () => void) => Unsubscribe;
}
export interface SampleEditorSnapshot {
  readonly selection: SampleSelection;
  readonly state: SampleState | null;
  readonly isBusy: boolean;
  readonly isValidating: boolean;
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
const ERROR_KEYS: Readonly<Record<string, MessageKey>> = {
  scope: "mobile.sample.scopeUnavailable",
  shift: "mobile.sample.shiftRequired",
  configuration: "mobile.sample.configurationUnavailable",
  source: "mobile.sample.sourceUnavailable",
  origin: "mobile.sample.originRequired",
  method: "mobile.sample.methodRequired",
  code: "mobile.sample.codeRequired",
  other: "mobile.sample.otherRequired",
  gps: "mobile.sample.gpsRequired",
  evidence: "mobile.sample.evidenceRequired",
  stale_draft: "mobile.sample.staleDraft",
  camera_permission_denied: "mobile.camera.permissionDenied",
  camera_permission_blocked: "mobile.camera.permissionBlocked",
  camera_unavailable: "mobile.sample.photoUnavailable",
  camera_result_invalid: "mobile.camera.resultInvalid",
  camera_busy: "mobile.camera.busy",
  camera_unlock_required: "mobile.camera.unlockRequired",
  owner_unproven: "mobile.camera.ownerRequired",
  owner_conflict: "mobile.camera.ownerRequired",
  stale_context: "mobile.sample.staleDraft",
  file_type: "mobile.camera.fileType",
  file_size: "mobile.camera.fileSize",
};
export function sampleGateKey(code: string): MessageKey {
  return ERROR_KEYS[code] ?? "mobile.sample.configurationUnavailable";
}
export function sampleErrorKey(error: unknown): MessageKey {
  if (error instanceof ShiftBlockedError) return "mobile.sample.shiftRequired";
  const code = error instanceof Error && "code" in error ? error.code : null;
  return typeof code === "string"
    ? (ERROR_KEYS[code] ?? "mobile.sample.storageError")
    : "mobile.sample.storageError";
}
function selectionKey(selection: SampleSelection): string {
  return JSON.stringify([selection.sampleId, selection.sourceRef, selection.manualCapture]);
}
/** Reads, physical actions and raw edits remain tied to the exact owner/session and sample. */
export class SampleEditorController {
  readonly #deps: Dependencies;
  readonly #listeners = new Set<() => void>();
  #snapshot: SampleEditorSnapshot;
  #stops: readonly Unsubscribe[] = [];
  #isActive = false;
  #epoch = 0;
  #request = 0;
  #identity: string | null;
  #contextId: string | undefined;
  constructor(deps: Dependencies) {
    this.#deps = deps;
    this.#identity = deps.identityKey();
    this.#snapshot = {
      selection: deps.selection,
      state: null,
      isBusy: false,
      isValidating: false,
      errorKey: null,
      touchedId: null,
    };
  }
  getSnapshot = (): SampleEditorSnapshot => this.#snapshot;
  subscribe = (listener: () => void): Unsubscribe => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };
  #publish(patch: Partial<SampleEditorSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }
  start(): void {
    if (this.#isActive) return;
    this.#isActive = true;
    const reload = () => {
      void this.load();
    };
    this.#stops = [
      this.#deps.service.subscribe(reload),
      this.#deps.subscribeSync(reload),
      this.#deps.subscribeScope(() => {
        void this.load(true);
      }),
      this.#deps.subscribeAuth(() => {
        this.#authChanged();
      }),
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
  async load(shouldInvalidate = false): Promise<void> {
    if (!this.#isActive) return;
    if (shouldInvalidate) {
      this.#epoch++;
      this.#contextId = undefined;
      this.#publish({ state: null, errorKey: null });
    }
    const identity = this.#deps.identityKey();
    if (identity === null || !this.#deps.isUnlocked()) {
      this.#publish({ state: null });
      return;
    }
    await this.#read(this.#readLease(identity));
  }
  async #read(lease: ReadLease): Promise<void> {
    try {
      const state = await this.#deps.service.read(this.#snapshot.selection);
      if (this.#isCurrentRead(lease)) {
        this.#contextId = state.draft?.sampleId;
        this.#publish({
          state: this.#deps.buffer.merge(state),
          isValidating: this.#deps.buffer.hasPending(state.draft?.sampleId),
        });
      }
    } catch (error) {
      if (this.#isCurrentRead(lease)) this.#publish({ errorKey: sampleErrorKey(error) });
    }
  }
  #lease(sampleId?: string, allowLocked = false): () => boolean {
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
      (sampleId === undefined || this.#contextId === sampleId);
  }
  async #operate(action: (isCurrent: () => boolean) => Promise<unknown>, allowLocked = false) {
    if (!this.#canOperate()) return;
    const id = this.#snapshot.state?.draft?.sampleId,
      isCurrent = this.#lease(id, allowLocked);
    this.#publish({ isBusy: true, errorKey: null });
    try {
      if (id !== undefined) await this.#deps.buffer.persist(id);
      if (!isCurrent()) return;
      await action(isCurrent);
      if (isCurrent()) await this.load();
    } catch (error) {
      if (isCurrent()) this.#publish({ errorKey: sampleErrorKey(error) });
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
  #select(selection: SampleSelection): void {
    this.#epoch++;
    this.#contextId = undefined;
    this.#publish({ selection, state: null, touchedId: null });
  }
  chooseSource(sourceRef: SampleSelection["sourceRef"]): void {
    if (this.#snapshot.state?.draft) return;
    void this.#operate(async () => {
      this.#select({ ...this.#snapshot.selection, sourceRef });
      await this.load();
    });
  }
  openDraft = (sampleId: string): void => {
    void this.#operate(async () => {
      this.#select({ ...this.#snapshot.selection, sampleId, sourceRef: null });
      await this.load();
    });
  };
  begin = (): void => {
    void this.#operate(async (isCurrent) => {
      const sampleId = await this.#deps.service.begin(this.#snapshot.selection);
      if (!isCurrent()) return;
      this.#select({ ...this.#snapshot.selection, sampleId });
      await this.load();
    });
  };
  edit = (patch: SamplePatch): void => {
    const state = this.#snapshot.state,
      draft = state?.draft;
    if (!state?.ready || !draft || state.event || this.#snapshot.isBusy) return;
    const isCurrent = this.#lease(draft.sampleId);
    if (!isCurrent()) return;
    this.#deps.buffer.edit(draft.sampleId, patch, (latest) =>
      this.#deps.service.edit(draft.sampleId, latest),
    );
    this.#publish({ state: this.#deps.buffer.merge(state), isValidating: true });
    void this.#persistEdit(draft.sampleId, isCurrent);
  };
  async #persistEdit(id: string, isCurrent: () => boolean): Promise<void> {
    try {
      await this.#deps.buffer.persist(id);
      if (isCurrent()) {
        this.#publish({ errorKey: null });
        await this.load();
      }
    } catch (error) {
      if (isCurrent()) this.#publish({ errorKey: sampleErrorKey(error) });
    }
  }
  blurFields = (): void => {
    this.#publish({ touchedId: this.#snapshot.state?.draft?.sampleId ?? null });
  };
  #capture(action: (id: string, isCurrent: () => boolean) => Promise<void>, allowLocked = false) {
    const id = this.#snapshot.state?.draft?.sampleId;
    if (id !== undefined) void this.#operate((isCurrent) => action(id, isCurrent), allowLocked);
  }
  save = (): void => {
    this.#capture((id, guard) => this.#deps.service.save(id, guard));
  };
  locate = (): void => {
    this.#capture((id, guard) => this.#deps.service.locate(id, guard));
  };
  photo = (): void => {
    this.#capture((id, guard) => this.#deps.service.photo(id, guard), true);
  };
  undoPhoto = (): void => {
    this.#capture((id) => this.#deps.service.undoPhoto(id));
  };
  retry = (): void => {
    void this.#operate((isCurrent) => this.#deps.refreshBundle(isCurrent));
  };
  hasPending(): boolean {
    return this.#deps.buffer.hasPending(this.#snapshot.state?.draft?.sampleId);
  }
}
