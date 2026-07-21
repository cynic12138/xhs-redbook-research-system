import { describe, expect, it, vi } from "vitest";

describe("browser URL opening", () => {
  it("uses the browser bridge without invoking the server fallback", async () => {
    const module = await import("../src/client/App.js") as {
      openUrlWithBrowserFallback?: (
        url: string,
        openWithBridge: (url: string) => Promise<void>,
        openWithServer: (url: string) => Promise<void>
      ) => Promise<void>;
    };
    expect(module.openUrlWithBrowserFallback).toBeTypeOf("function");

    const bridge = vi.fn(async () => undefined);
    const fallback = vi.fn(async () => undefined);
    await module.openUrlWithBrowserFallback!("https://www.xiaohongshu.com/", bridge, fallback);

    expect(bridge).toHaveBeenCalledWith("https://www.xiaohongshu.com/");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses the server fallback when the browser bridge is unavailable", async () => {
    const module = await import("../src/client/App.js") as {
      openUrlWithBrowserFallback?: (
        url: string,
        openWithBridge: (url: string) => Promise<void>,
        openWithServer: (url: string) => Promise<void>
      ) => Promise<void>;
    };
    expect(module.openUrlWithBrowserFallback).toBeTypeOf("function");

    const bridge = vi.fn(async () => {
      throw new Error("bridge unavailable");
    });
    const fallback = vi.fn(async () => undefined);
    await module.openUrlWithBrowserFallback!("https://www.xiaohongshu.com/", bridge, fallback);

    expect(fallback).toHaveBeenCalledWith("https://www.xiaohongshu.com/");
  });
});
