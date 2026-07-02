import { describe, expect, it } from "vitest";
import { compactContentText, noteToBatchReviewItem, prependUniqueById, severityLabel, upsertById } from "../src/client/App.js";

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

  it("maps a note into a selected batch review item", () => {
    expect(noteToBatchReviewItem({
      id: "note1",
      title: "孕妈出门携带",
      desc: "这是一篇需要审稿的小红书笔记正文。",
      keywords: ["孕期好物", "日常分享"]
    })).toEqual({
      id: "note_note1",
      title: "孕妈出门携带",
      body: "这是一篇需要审稿的小红书笔记正文。",
      tags: "孕期好物, 日常分享",
      selected: true
    });
  });

  it("compacts review text previews", () => {
    expect(compactContentText(" 第一段\n\n第二段  ", 20)).toBe("第一段 第二段");
    expect(compactContentText("", 20)).toBe("暂无内容");
    expect(compactContentText("1234567890", 6)).toBe("12345…");
  });

  it("labels review issue severity", () => {
    expect(severityLabel("blocker")).toBe("必须修改");
    expect(severityLabel("warning")).toBe("建议修改");
    expect(severityLabel("info")).toBe("提示");
  });
});
