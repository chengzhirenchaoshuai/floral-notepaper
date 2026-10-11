import { useTranslation } from "react-i18next";

interface EditorStatusBarProps {
  lineCount: number;
  byteSize: string;
  // 正文引用了 images/ 时显示“清理未使用图片”
  showCleanImages: boolean;
  onCleanImages: () => void;
}

// 编辑区底部状态栏
export function EditorStatusBar({
  lineCount,
  byteSize,
  showCleanImages,
  onCleanImages,
}: EditorStatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-4 h-7 border-t border-paper-deep/20 bg-paper/30 shrink-0">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-ink-ghost font-mono tabular-nums">
          {t("main.statusBar.lineNumber", {
            count: lineCount,
            defaultValue: "Ln {{count}}",
          })}
        </span>
        <span className="text-[10px] text-ink-ghost/40">|</span>
        <span className="text-[10px] text-ink-ghost font-mono">
          {t("main.statusBar.format", { defaultValue: "Markdown + LaTeX" })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {showCleanImages && (
          <>
            <button
              type="button"
              onClick={onCleanImages}
              className="text-[10px] text-ink-ghost hover:text-bamboo font-mono cursor-pointer transition-colors"
            >
              {t("main.images.cleanUnused", { defaultValue: "清理未使用图片" })}
            </button>
            <span className="text-[10px] text-ink-ghost/40">|</span>
          </>
        )}
        <span className="text-[10px] text-ink-ghost font-mono">
          {t("main.statusBar.encoding", { defaultValue: "UTF-8" })}
        </span>
        <span className="text-[10px] text-ink-ghost/40">|</span>
        <span className="text-[10px] text-ink-ghost font-mono tabular-nums">
          {t("main.statusBar.byteSize", { size: byteSize, defaultValue: "{{size}} KB" })}
        </span>
      </div>
    </div>
  );
}
