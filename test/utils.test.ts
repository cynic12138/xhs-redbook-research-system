import { describe, expect, it } from "vitest";
import { detectRiskSignal, hotScore, median, parseCount, ratio } from "../src/shared/utils.js";

describe("shared utils", () => {
  it("parses Chinese compact numbers", () => {
    expect(parseCount("115")).toBe(115);
    expect(parseCount("1.5万")).toBe(15_000);
    expect(parseCount("2.4亿")).toBe(240_000_000);
  });

  it("computes engagement ratios and hot score", () => {
    expect(ratio(25, 100)).toBe(0.25);
    expect(
      hotScore({
        likedCount: 100,
        commentCount: 10,
        collectedCount: 20,
        shareCount: 5
      })
    ).toBe(180);
  });

  it("computes medians", () => {
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 9, 3, 5])).toBe(4);
  });

  it("detects risk-control signals", () => {
    expect(detectRiskSignal({})).toContain("Empty response");
    expect(detectRiskSignal(new Error("NeedVerify required"))).toContain("NeedVerify");
    expect(detectRiskSignal(new Error("300012"))).toContain("300012");
  });
});
