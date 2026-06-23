import { describe, expect, it } from "vitest";
import { buildWebUrl, enrichWithWebUrl, parseNoteUrl } from "../src/server/services/url.js";

describe("url helpers", () => {
  it("parses Xiaohongshu note URLs by last path segment and xsec token", () => {
    expect(parseNoteUrl("https://www.xiaohongshu.com/explore/note123?xsec_token=tok123")).toEqual({
      noteId: "note123",
      xsecToken: "tok123"
    });

    expect(parseNoteUrl("note123")).toEqual({ noteId: "note123" });
  });

  it("builds canonical web URLs and preserves the no-token shape", () => {
    expect(buildWebUrl("note id")).toBe("https://www.xiaohongshu.com/explore/note%20id");
    expect(buildWebUrl("note id", "a+b", "feed")).toBe(
      "https://www.xiaohongshu.com/explore/note%20id?xsec_token=a%2Bb&xsec_source=feed"
    );
  });

  it("adds missing webUrl values recursively without replacing existing values", () => {
    const value = {
      card: { note_id: "note1", xsec_token: "tok1" },
      nested: [{ id: "note2", xsecToken: "tok2", webUrl: "existing" }]
    };

    expect(enrichWithWebUrl(value, "feed")).toBe(value);
    expect((value.card as { webUrl?: string }).webUrl).toBe(
      "https://www.xiaohongshu.com/explore/note1?xsec_token=tok1&xsec_source=feed"
    );
    expect(value.nested[0].webUrl).toBe("existing");
  });
});
