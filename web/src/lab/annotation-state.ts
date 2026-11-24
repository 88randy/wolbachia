import type { Schemas } from "@wolbachia/api-client";

/** Server-defined geometry; editor history never adds metadata to the payload. */
export type AnnotationMark = Schemas["EggMark"];

export const MAX_ANNOTATION_MARKS = 5000;
const MAX_UNDO_STEPS = 100;

export interface AnnotationState {
  marks: AnnotationMark[];
  past: AnnotationMark[][];
  future: AnnotationMark[][];
}

export type AnnotationAction =
  | { type: "add"; mark: AnnotationMark }
  | { type: "update"; index: number; mark: AnnotationMark }
  | { type: "delete"; index: number }
  | { type: "replace"; marks: AnnotationMark[] }
  | { type: "undo" }
  | { type: "redo" };

export function createAnnotationState(marks: AnnotationMark[] = []): AnnotationState {
  return { marks, past: [], future: [] };
}

function commitMarks(state: AnnotationState, marks: AnnotationMark[]): AnnotationState {
  if (marks === state.marks || marks.length > MAX_ANNOTATION_MARKS) return state;
  return { marks, past: [...state.past, state.marks].slice(-MAX_UNDO_STEPS), future: [] };
}

function editMarks(marks: AnnotationMark[], action: AnnotationAction): AnnotationMark[] {
  if (action.type === "replace") return action.marks;
  if (action.type === "add") return [...marks, action.mark];
  if (action.type !== "update" && action.type !== "delete") return marks;
  if (action.index < 0 || action.index >= marks.length) return marks;
  if (action.type === "delete") return marks.filter((_, index) => index !== action.index);
  return marks.map((mark, index) => (index === action.index ? action.mark : mark));
}

/** Every completed pointer gesture is one immutable history step. */
export function annotationReducer(
  state: AnnotationState,
  action: AnnotationAction,
): AnnotationState {
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous
      ? {
          marks: previous,
          past: state.past.slice(0, -1),
          future: [state.marks, ...state.future],
        }
      : state;
  }
  if (action.type === "redo") {
    const next = state.future[0];
    return next
      ? {
          marks: next,
          past: [...state.past, state.marks],
          future: state.future.slice(1),
        }
      : state;
  }
  return commitMarks(state, editMarks(state.marks, action));
}
