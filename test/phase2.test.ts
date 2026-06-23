import { describe, expect, it } from "vitest";
import type { NoteRecord } from "../src/shared/types.js";
import { redbookCapabilities } from "../src/server/services/capabilities.js";
import { diagnoseNote } from "../src/server/services/healthService.js";

const note: NoteRecord = {
  id: "n1",
  jobIds: ["job1"],
  keywords: ["武汉相亲"],
  title: "武汉相亲第一避坑清单",
  desc: "加我私信 #相亲 #脱单 #武汉 #情感 #避坑 #攻略 #线下 #真实 #清单",
  type: "normal",
  webUrl: "https://www.xiaohongshu.com/explore/n1?xsec_token=t",
  noteUrl: "https://www.xiaohongshu.com/explore/n1",
  likedCount: 100,
  collectedCount: 30,
  commentCount: 12,
  shareCount: 3,
  hotScore: 199,
  createdAt: "2026-06-18T00:00:00.000Z",
  updatedAt: "2026-06-18T00:00:00.000Z"
};

describe("phase 2 capabilities", () => {
  it("maps every redbook command group into a UI module", () => {
    const commands = redbookCapabilities.map((item) => item.command).join(" ");

    expect(commands).toContain("search");
    expect(commands).toContain("read");
    expect(commands).toContain("comment / reply / batch-reply");
    expect(commands).toContain("post / delete");
    expect(redbookCapabilities.every((item) => item.module && item.status && item.risk)).toBe(true);
  });

  it("diagnoses local note health risks without creator data", () => {
    const result = diagnoseNote(note, { level: 3 });

    expect(result.levelLabel).toBe("高风险限流");
    expect(result.sensitiveHits).toContain("第一");
    expect(result.sensitiveHits).toContain("私信");
    expect(result.tagWarning).toBe(true);
  });
});

