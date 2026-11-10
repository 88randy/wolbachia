import { describe, expect, test } from "vitest";
import { canReview } from "./review-command";
import type { Review } from "./review-query";

describe("review acceptance safety", () => {
  test("a rejected release cannot bypass the mandatory server evaluation", () => {
    const review = {
      decision_state: { terminal: false },
      evaluation: { can_accept: false },
    } as Review;
    expect(canReview(review, "accept")).toBe(false);
    expect(canReview(review, "open_incident")).toBe(true);
    expect(canReview(review, "void")).toBe(true);
  });
  test("terminal decisions cannot be overridden by any action", () => {
    const review = {
      decision_state: { terminal: true },
      evaluation: { can_accept: true },
    } as Review;
    expect(
      ["accept", "void", "open_incident"].map((action) =>
        canReview(review, action as Parameters<typeof canReview>[1]),
      ),
    ).toEqual([false, false, false]);
  });
});
