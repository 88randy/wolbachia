import type { Polygon } from "../geography/geometry";

export type ShapeKind = "quadrant" | "block" | "sampling" | "release";
export interface PointGeometry {
  type: "Point";
  coordinates: number[];
}
export type ShapeGeometry = Polygon | PointGeometry;

/** The saved record a shape was loaded from (absent for brand-new shapes). */
export interface SavedRef {
  recordId: string;
  revision: number;
  /** Code of the saved record, shown in the pending list. */
  code: string;
  original: ShapeGeometry;
}

/** One unsaved (or being-edited) shape of the single editor draft session. */
export interface DraftShape {
  /** Terra Draw feature id; stays the same across undo and redo. */
  key: string;
  kind: ShapeKind;
  geometry: ShapeGeometry;
  code: string;
  centerId: string;
  saved: SavedRef | null;
}

export interface Draft {
  shapes: readonly DraftShape[];
}

export const EMPTY_DRAFT: Draft = { shapes: [] };
export const HISTORY_LIMIT = 100;

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** A new shape always counts; a loaded record only counts once its geometry moved. */
export function isChanged(shape: DraftShape): boolean {
  return !shape.saved || !sameJson(shape.geometry, shape.saved.original);
}

export const changedShapes = (draft: Draft) => draft.shapes.filter(isChanged);

export function upsertShape(draft: Draft, shape: DraftShape): Draft {
  const exists = draft.shapes.some((item) => item.key === shape.key);
  return {
    shapes: exists
      ? draft.shapes.map((item) => (item.key === shape.key ? shape : item))
      : [...draft.shapes, shape],
  };
}

export function patchShape(draft: Draft, key: string, patch: Partial<DraftShape>): Draft {
  return { shapes: draft.shapes.map((item) => (item.key === key ? { ...item, ...patch } : item)) };
}

export function removeShapes(draft: Draft, keys: ReadonlySet<string>): Draft {
  return { shapes: draft.shapes.filter((item) => !keys.has(item.key)) };
}

export interface History {
  present: Draft;
  past: readonly Draft[];
  future: readonly Draft[];
}

export type HistoryAction =
  | { type: "commit"; next: Draft }
  | { type: "replace"; next: Draft }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "reset" };

export const INITIAL_HISTORY: History = { present: EMPTY_DRAFT, past: [], future: [] };

/** Snapshot history of the draft session: every commit is one undo step, capped at 100. */
export function historyReducer(state: History, action: HistoryAction): History {
  switch (action.type) {
    case "commit":
      return {
        present: action.next,
        past: [...state.past, state.present].slice(-HISTORY_LIMIT),
        future: [],
      };
    case "replace":
      return { ...state, present: action.next };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
      };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { present: next, past: [...state.past, state.present], future: rest };
    }
    case "reset":
      return INITIAL_HISTORY;
  }
}
