import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { Tile } from "./Tile";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

// 懒加载组件在静态渲染中只会输出 fallback，这里直接换成真实的预览组件
vi.mock("../features/markdown/MarkdownPreviewLazy", async () => {
  const actual = await vi.importActual<typeof import("../features/markdown/MarkdownPreview")>(
    "../features/markdown/MarkdownPreview",
  );
  return { MarkdownPreviewLazy: actual.MarkdownPreview };
});

describe("Tile", () => {
  test("renders inline HTML when Markdown rendering is on, same as the main preview", () => {
    const markup = renderToStaticMarkup(
      <Tile content={"<mark>重点</mark><script>alert(1)</script>"} renderMarkdown />,
    );

    expect(markup).toContain("<mark>重点</mark>");
    expect(markup).not.toContain("<script");
  });

  test("shows raw text when Markdown rendering is off", () => {
    const markup = renderToStaticMarkup(<Tile content={"<mark>重点</mark>"} />);

    expect(markup).not.toContain("<mark>");
    expect(markup).toContain("&lt;mark&gt;重点&lt;/mark&gt;");
  });
});
