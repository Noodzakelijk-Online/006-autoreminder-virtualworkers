import { describe, expect, it } from "vitest";
import { DEFAULT_PRIORITY_RESULT, EXECUTION_ORDER, PRIORITY_CLASSIFIER_QUESTIONS, PRIORITY_MATRIX } from "./priorityPlaybook";

describe("priority playbook", () => {
  it("keeps the classifier, matrix, and execution reference aligned", () => {
    expect(PRIORITY_CLASSIFIER_QUESTIONS).toHaveLength(7);
    expect(PRIORITY_MATRIX.map((item) => item.level)).toEqual(["P0", "P1", "P2", "P3", "P4", "P5"]);
    expect(EXECUTION_ORDER).toHaveLength(PRIORITY_CLASSIFIER_QUESTIONS.length);
    expect(DEFAULT_PRIORITY_RESULT.label).toContain("P5");
  });
});
