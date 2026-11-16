import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { MarkdownPreview } from "./MarkdownPreview";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("MarkdownPreview", () => {
  test("marks rendered Markdown content as selectable", () => {
    const markup = renderToStaticMarkup(<MarkdownPreview content="# 花笺\n\n正文" />);

    expect(markup).toContain("markdown-selectable");
    expect(markup).toContain("<h1");
    expect(markup).toContain("花笺");
    expect(markup).toContain("正文");
  });

  test("renders single line breaks inside a paragraph as <br> by default", () => {
    const markup = renderToStaticMarkup(
      <MarkdownPreview content={"**日期**：2026-11-16\n**环境**：验证环境"} />,
    );

    expect(markup).toMatch(/2026-11-16<br\/?>/);
  });

  test("keeps standard soft breaks when preserveLineBreaks is off", () => {
    const markup = renderToStaticMarkup(
      <MarkdownPreview
        content={"**日期**：2026-11-16\n**环境**：验证环境"}
        preserveLineBreaks={false}
      />,
    );

    expect(markup).not.toContain("<br");
  });

  test("renders inline HTML by default and strips unsafe tags", () => {
    const markup = renderToStaticMarkup(
      <MarkdownPreview
        content={'<mark>重点</mark><script>alert(1)</script><img src="x" onerror="alert(1)">'}
      />,
    );

    expect(markup).toContain("<mark>重点</mark>");
    expect(markup).not.toContain("<script");
    expect(markup).not.toContain("onerror");
  });

  test("escapes inline HTML when renderHtml is off", () => {
    const markup = renderToStaticMarkup(
      <MarkdownPreview content={"<mark>重点</mark>"} renderHtml={false} />,
    );

    expect(markup).not.toContain("<mark>");
  });

  test("does not add line breaks inside code blocks", () => {
    const markup = renderToStaticMarkup(<MarkdownPreview content={"```\na\nb\n```"} />);

    expect(markup).not.toContain("<br");
  });

  test("keeps code block controls outside the horizontally scrollable pre", () => {
    const markup = renderToStaticMarkup(
      <MarkdownPreview content={"```text\nvery long code line\n```"} />,
    );

    const preCloseIndex = markup.indexOf("</pre>");
    const buttonIndex = markup.indexOf("<button");

    expect(markup).toContain("markdown-code-block");
    expect(markup).toContain("markdown-code-scroll");
    expect(preCloseIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(preCloseIndex);
  });
});
