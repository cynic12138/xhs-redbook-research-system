import { describe, expect, it } from "vitest";
import { prependUniqueById, upsertById } from "../src/client/App.js";

describe("client list merge helpers", () => {
  it("upserts one item to the front and removes its older copy", () => {
    const result = upsertById([{ id: "old", value: 1 }, { id: "keep", value: 2 }], { id: "old", value: 3 });

    expect(result).toEqual([{ id: "old", value: 3 }, { id: "keep", value: 2 }]);
  });

  it("prepends a batch while preserving incoming order and removing old copies", () => {
    const result = prependUniqueById(
      [{ id: "a", value: 1 }, { id: "b", value: 2 }, { id: "c", value: 3 }],
      [{ id: "c", value: 30 }, { id: "a", value: 10 }]
    );

    expect(result).toEqual([{ id: "c", value: 30 }, { id: "a", value: 10 }, { id: "b", value: 2 }]);
  });

  it("keeps only the first item when an incoming batch repeats ids", () => {
    const result = prependUniqueById([{ id: "existing", value: 1 }], [
      { id: "next", value: 2 },
      { id: "next", value: 3 }
    ]);

    expect(result).toEqual([{ id: "next", value: 2 }, { id: "existing", value: 1 }]);
  });
});
