import { messages } from "@wolbachia/i18n";
import { describe, expect, it } from "vitest";
import { TUTORIALS } from "./definitions";
import { layoutFlow } from "./flow-layout";
import { stepKey, titleKey } from "./tutorial-keys";
import { TUTORIAL_IDS, TUTORIAL_ROUTES } from "./tutorial-routes";
import { linkTarget } from "./types";

describe("tutorial definitions", () => {
  it("has a definition for every id and a tutorial for every mapped route", () => {
    for (const id of TUTORIAL_IDS) expect(TUTORIALS[id].id).toBe(id);
    for (const id of Object.values(TUTORIAL_ROUTES)) expect(TUTORIAL_IDS).toContain(id);
  });

  it("has copy in both languages for every title, label and caption", () => {
    for (const tutorial of Object.values(TUTORIALS)) {
      for (const locale of ["es-MX", "en"] as const) {
        expect(messages[locale][titleKey(tutorial.id)]).toBeTruthy();
        for (const step of tutorial.steps) {
          expect(messages[locale][stepKey(tutorial.id, step.id, "label")]).toBeTruthy();
          expect(messages[locale][stepKey(tutorial.id, step.id, "caption")]).toBeTruthy();
        }
      }
    }
  });

  it("only links to existing steps and lays every step out", () => {
    for (const tutorial of Object.values(TUTORIALS)) {
      const ids = new Set(tutorial.steps.map((step) => step.id));
      for (const step of tutorial.steps) {
        for (const link of step.next) expect(ids).toContain(linkTarget(link));
      }
      expect(layoutFlow(tutorial).nodes).toHaveLength(tutorial.steps.length);
    }
  });
});
