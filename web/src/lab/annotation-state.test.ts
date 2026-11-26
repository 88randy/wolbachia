import { describe, expect, test } from "vitest";
import { annotationReducer, createAnnotationState } from "./annotation-state";

describe("immutable annotation edit history", () => {
  test("field-equal edits preserve redo and do not add an undo step", () => {
    const box = { kind: "box", x: 100, y: 100, w: 12, h: 24 } as const;
    const moved = annotationReducer(createAnnotationState([box]), {
      type: "update",
      index: 0,
      mark: { ...box, x: 110 },
    });
    const undone = annotationReducer(moved, { type: "undo" });
    expect(annotationReducer(undone, { type: "replace", marks: [{ ...box }] })).toBe(undone);
    expect(annotationReducer(undone, { type: "update", index: 0, mark: { ...box } })).toBe(undone);
  });

  test("recovery seeds history rather than allowing undo to erase the draft", () => {
    const mark = { kind: "point", x: 3, y: 5 } as const;
    const recovered = annotationReducer(createAnnotationState(), { type: "reset", marks: [mark] });
    expect(annotationReducer(recovered, { type: "undo" }).marks).toEqual([mark]);
    expect(annotationReducer(recovered, { type: "redo" })).toBe(recovered);
  });

  test("undoes and redoes adding, moving and deleting mixed marks", () => {
    const box = { kind: "box", x: 5, y: 8, w: 12, h: 6 } as const;
    const point = { kind: "point", x: 25, y: 31 } as const;
    const empty = createAnnotationState();
    const added = annotationReducer(empty, { type: "add", mark: box });
    const mixed = annotationReducer(added, { type: "add", mark: point });
    const moved = annotationReducer(mixed, {
      type: "update",
      index: 0,
      mark: { ...box, x: 20 },
    });
    const deleted = annotationReducer(moved, { type: "delete", index: 1 });
    expect(deleted.marks).toEqual([{ ...box, x: 20 }]);
    const restored = annotationReducer(deleted, { type: "undo" });
    expect(restored.marks).toEqual(moved.marks);
    expect(annotationReducer(restored, { type: "redo" }).marks).toEqual(deleted.marks);
    const original = annotationReducer(annotationReducer(restored, { type: "undo" }), {
      type: "undo",
    });
    expect(original.marks).toEqual([box]);
    expect(empty.marks).toEqual([]);
  });

  test("commits a drag as one undo step and clears redo after a new edit", () => {
    const point = { kind: "point", x: 1, y: 2 } as const;
    const initial = createAnnotationState([point]);
    const moved = annotationReducer(initial, {
      type: "replace",
      marks: [{ ...point, x: 20, y: 30 }],
    });
    const undone = annotationReducer(moved, { type: "undo" });
    expect(undone.marks).toEqual([point]);
    const edited = annotationReducer(undone, { type: "add", mark: point });
    expect(annotationReducer(edited, { type: "redo" })).toBe(edited);
  });

  test("does not create phantom history for absent selections or exceed 5000 marks", () => {
    const mark = { kind: "point", x: 0, y: 0 } as const;
    const state = createAnnotationState(Array.from({ length: 5000 }, () => mark));
    expect(annotationReducer(state, { type: "add", mark })).toBe(state);
    expect(annotationReducer(state, { type: "delete", index: -1 })).toBe(state);
    expect(annotationReducer(state, { type: "update", index: 6000, mark })).toBe(state);
  });
});
