import { describe, expect, it } from "vitest";
import type { ContentPlaybook } from "../src/shared/types.js";
import { resolvePlaybookRefreshState } from "../src/client/App.js";

describe("content playbook refresh state", () => {
  it("keeps the selected playbook when it still exists", () => {
    const state = resolvePlaybookRefreshState([playbook("a"), playbook("b")], "b", false);

    expect(state).toMatchObject({
      selectedId: "b",
      playbook: { id: "b" },
      applyForm: true
    });
  });

  it("falls back to the first playbook when the selected one disappears", () => {
    const state = resolvePlaybookRefreshState([playbook("a"), playbook("b")], "missing", false);

    expect(state).toMatchObject({
      selectedId: "a",
      playbook: { id: "a" },
      applyForm: true
    });
  });

  it("does not apply remote form data while the local editor is dirty", () => {
    const state = resolvePlaybookRefreshState([playbook("server")], "local-draft", true);

    expect(state).toEqual({
      selectedId: "local-draft",
      applyForm: false
    });
  });
});

function playbook(id: string): ContentPlaybook {
  return {
    id,
    name: `规则 ${id}`,
    productName: `产品 ${id}`,
    category: "小红书种草",
    forbiddenTerms: [],
    sensitiveClaims: [],
    allowedSellingPoints: [],
    requiredSections: [],
    toneWords: [],
    personas: [],
    scenarios: [],
    tags: [],
    replacements: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z"
  };
}
