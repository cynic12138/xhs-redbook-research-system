import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { renderInline } from "../src/client/App.js";

type ElementProps = {
  children?: ReactNode;
  href?: string;
};

function textOf(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isValidElement(node)) {
    return textOf((node as ReactElement<ElementProps>).props.children);
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  return "";
}

function elementsOfType(nodes: ReactNode[], type: string): Array<ReactElement<ElementProps>> {
  return nodes.filter((node): node is ReactElement<ElementProps> => isValidElement(node) && node.type === type);
}

describe("MarkdownView inline rendering", () => {
  it("renders strong markdown in normal text", () => {
    const nodes = renderInline("平均笔记点赞数：**114**（收藏率 `0.34`）");

    expect(textOf(nodes)).toBe("平均笔记点赞数：114（收藏率 0.34）");
    expect(textOf(elementsOfType(nodes, "strong")[0])).toBe("114");
    expect(textOf(elementsOfType(nodes, "code")[0])).toBe("0.34");
  });

  it("renders strong markdown in list item text", () => {
    const nodes = renderInline("**痛点+结果承诺**");

    expect(textOf(elementsOfType(nodes, "strong")[0])).toBe("痛点+结果承诺");
  });

  it("keeps inline code from being parsed as strong text", () => {
    const nodes = renderInline("示例 `**raw**` 和 **bold**");

    expect(textOf(elementsOfType(nodes, "code")[0])).toBe("**raw**");
    expect(textOf(elementsOfType(nodes, "strong")[0])).toBe("bold");
  });

  it("renders links, emphasis, and deletion without losing text", () => {
    const nodes = renderInline("[入口](https://example.com) *斜体* _强调_ ~~删除~~");

    expect(elementsOfType(nodes, "a")[0]?.props.href).toBe("https://example.com");
    expect(elementsOfType(nodes, "em").map(textOf)).toEqual(["斜体", "强调"]);
    expect(textOf(elementsOfType(nodes, "del")[0])).toBe("删除");
    expect(textOf(nodes)).toBe("入口 斜体 强调 删除");
  });

  it("leaves unclosed markdown markers unchanged", () => {
    expect(textOf(renderInline("平均 **114"))).toBe("平均 **114");
  });
});
