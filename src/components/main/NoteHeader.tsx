import { useMemo } from "react";
import { useTranslation } from "react-i18next";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

interface NoteHeaderProps {
  // 变化时重新播放切换动画
  transitionKey: number;
  title: string;
  onTitleChange: (value: string) => void;
  // 标题框按回车时把焦点移到正文
  onSubmit: () => void;
  disabled: boolean;
  // 时间或外部文件路径
  metaText: string;
  charCount: number;
  saveState: SaveState;
}

// 笔记标题输入框与元信息行（时间、字数、保存状态）
export function NoteHeader({
  transitionKey,
  title,
  onTitleChange,
  onSubmit,
  disabled,
  metaText,
  charCount,
  saveState,
}: NoteHeaderProps) {
  const { t } = useTranslation();
  const saveStateLabel = useMemo<Record<SaveState, string>>(
    () => ({
      idle: t("main.statusBar.saveState.idle", { defaultValue: "未选择" }),
      dirty: t("main.statusBar.saveState.dirty", { defaultValue: "未保存" }),
      saving: t("main.statusBar.saveState.saving", { defaultValue: "保存中" }),
      saved: t("main.statusBar.saveState.saved", { defaultValue: "已保存" }),
      error: t("main.statusBar.saveState.error", { defaultValue: "保存失败" }),
    }),
    [t],
  );

  return (
    <div
      key={transitionKey}
      className="animate-note-enter px-6 pt-4 pb-2 shrink-0 border-b border-paper-deep/15"
    >
      <input
        type="text"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit();
          }
        }}
        placeholder={t("common.untitledNote", { defaultValue: "无标题笔记" })}
        disabled={disabled}
        className="w-full text-[20px] font-display font-bold text-ink placeholder:text-ink-ghost/50 tracking-wide disabled:opacity-60"
      />
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-[10px] text-ink-ghost font-mono tabular-nums truncate max-w-[200px]">
          {metaText}
        </span>
        <span className="text-[10px] text-ink-ghost/40">·</span>
        <span className="text-[10px] text-ink-ghost font-mono tabular-nums">
          {t("common.wordCount", { count: charCount, defaultValue: "{{count}} 字" })}
        </span>
        <span className="text-[10px] text-ink-ghost/40">·</span>
        <span
          key={saveState}
          className={`text-[10px] font-mono tabular-nums animate-status-fade ${
            saveState === "error"
              ? "text-red-400"
              : saveState === "dirty"
                ? "text-amber-500/70"
                : "text-bamboo/60"
          }`}
        >
          {saveStateLabel[saveState]}
        </span>
      </div>
    </div>
  );
}
