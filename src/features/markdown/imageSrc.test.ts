import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveExternalLocalImagePath, resolveMarkdownImageSrc } from "./imageSrc";

describe("resolveMarkdownImageSrc", () => {
  const convertFileSrc = vi.fn((path: string) => `asset://${path}`);

  beforeEach(() => {
    convertFileSrc.mockClear();
  });

  test("resolves note image paths under the images directory", () => {
    expect(resolveMarkdownImageSrc("images/photo.png", "/notes/note-1", convertFileSrc)).toBe(
      "asset:///notes/note-1/images/photo.png",
    );
    expect(convertFileSrc).toHaveBeenCalledWith("/notes/note-1/images/photo.png");
  });

  test("normalizes Windows-style separators before resolving note images", () => {
    expect(resolveMarkdownImageSrc("images\\photo.png", "C:/notes/note-1", convertFileSrc)).toBe(
      "asset://C:/notes/note-1/images/photo.png",
    );
    expect(convertFileSrc).toHaveBeenCalledWith("C:/notes/note-1/images/photo.png");
  });

  test("decodes percent-encoded note image paths before converting", () => {
    expect(
      resolveMarkdownImageSrc("images/%E5%9B%BE%E7%89%87.png", "/notes/note-1", convertFileSrc),
    ).toBe("asset:///notes/note-1/images/图片.png");
    expect(convertFileSrc).toHaveBeenCalledWith("/notes/note-1/images/图片.png");
  });

  test("keeps non-note image paths unchanged", () => {
    expect(
      resolveMarkdownImageSrc("https://example.com/photo.png", "/notes/note-1", convertFileSrc),
    ).toBe("https://example.com/photo.png");
    expect(resolveMarkdownImageSrc("./photo.png", "/notes/note-1", convertFileSrc)).toBe(
      "./photo.png",
    );
    expect(convertFileSrc).not.toHaveBeenCalled();
  });

  test("keeps image paths unchanged when the base directory is unavailable", () => {
    expect(resolveMarkdownImageSrc("images/photo.png", undefined, convertFileSrc)).toBe(
      "images/photo.png",
    );
    expect(convertFileSrc).not.toHaveBeenCalled();
  });

  test("returns an empty string for missing sources", () => {
    expect(resolveMarkdownImageSrc(undefined, "/notes/note-1", convertFileSrc)).toBe("");
  });
});

describe("resolveExternalLocalImagePath", () => {
  test("resolves absolute Windows paths directly, regardless of context", () => {
    expect(resolveExternalLocalImagePath("D:\\pics\\a.png", undefined)).toBe("D:/pics/a.png");
  });

  test("resolves relative paths against the external file's directory", () => {
    expect(resolveExternalLocalImagePath("icons/a.png", "D:/docs/note")).toBe(
      "D:/docs/note/icons/a.png",
    );
  });

  test("decodes percent-encoded paths produced by react-markdown", () => {
    // 原文 图/TPOPS-WDR报告页面.png 经 mdast-util-to-hast 转义后的样子
    expect(
      resolveExternalLocalImagePath(
        "%E5%9B%BE/TPOPS-WDR%E6%8A%A5%E5%91%8A%E9%A1%B5%E9%9D%A2.png",
        "F:/docs/专题",
      ),
    ).toBe("F:/docs/专题/图/TPOPS-WDR报告页面.png");
    expect(resolveExternalLocalImagePath("my%20dir/a%20b.png", "D:/docs")).toBe(
      "D:/docs/my dir/a b.png",
    );
    expect(resolveExternalLocalImagePath("D:%5Cpics%5C%E5%9B%BE.png", undefined)).toBe(
      "D:/pics/图.png",
    );
  });

  test("keeps paths with invalid escape sequences unchanged", () => {
    expect(resolveExternalLocalImagePath("100%/a.png", "D:/docs")).toBe("D:/docs/100%/a.png");
  });

  test("returns undefined for remote URLs and unresolvable relative paths", () => {
    expect(
      resolveExternalLocalImagePath("https://example.com/a.png", "D:/docs/note"),
    ).toBeUndefined();
    expect(resolveExternalLocalImagePath("icons/a.png", undefined)).toBeUndefined();
    expect(resolveExternalLocalImagePath(undefined, "D:/docs/note")).toBeUndefined();
  });
});
