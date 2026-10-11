import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { FormatAction } from "../../features/editor/formatting";

interface FormatToolbarProps {
  onFormat: (action: FormatAction) => void;
  onInsertImage: () => void;
}

// 编辑器上方的 Markdown 格式按钮条
export function FormatToolbar({ onFormat, onInsertImage }: FormatToolbarProps) {
  const { t } = useTranslation();
  const buttons = useMemo<{ label: string; title: string; style: string; action: FormatAction }[]>(
    () => [
      {
        label: "B",
        title: t("main.toolbar.bold", { defaultValue: "粗体" }),
        style: "font-bold",
        action: "bold",
      },
      {
        label: "I",
        title: t("main.toolbar.italic", { defaultValue: "斜体" }),
        style: "italic",
        action: "italic",
      },
      {
        label: "H",
        title: t("main.toolbar.heading", { defaultValue: "标题" }),
        style: "font-bold",
        action: "heading",
      },
      {
        label: "—",
        title: t("main.toolbar.hr", { defaultValue: "分割线" }),
        style: "",
        action: "hr",
      },
      {
        label: "•",
        title: t("main.toolbar.ul", { defaultValue: "无序列表" }),
        style: "",
        action: "ul",
      },
      {
        label: "1.",
        title: t("main.toolbar.ol", { defaultValue: "有序列表" }),
        style: "font-mono text-[9px]",
        action: "ol",
      },
      {
        label: "<>",
        title: t("main.toolbar.code", { defaultValue: "代码" }),
        style: "font-mono text-[9px]",
        action: "code",
      },
      {
        label: "❝",
        title: t("main.toolbar.quote", { defaultValue: "引用" }),
        style: "",
        action: "quote",
      },
      {
        label: "∑",
        title: t("main.toolbar.inlineMath", { defaultValue: "行内公式" }),
        style: "font-mono text-[11px]",
        action: "inlineMath",
      },
      {
        label: "∫",
        title: t("main.toolbar.blockMath", { defaultValue: "块级公式" }),
        style: "font-mono text-[11px]",
        action: "blockMath",
      },
    ],
    [t],
  );

  return (
    <div className="flex items-center gap-0.5 px-4 pt-2 pb-1 shrink-0">
      {buttons.map((button) => (
        <button
          key={button.label}
          title={button.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onFormat(button.action)}
          className={`w-6 h-6 flex items-center justify-center rounded text-[11px] text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer ${button.style}`}
        >
          {button.label}
        </button>
      ))}
      <span className="w-px h-4 mx-1 bg-paper-deep/50" aria-hidden="true" />
      <button
        title={t("main.toolbar.insertImage", { defaultValue: "插入本地图片" })}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onInsertImage}
        className="w-6 h-6 flex items-center justify-center rounded text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </button>
    </div>
  );
}
