import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { NoteMetadata } from "../../features/notes/types";
import { formatShortDate, formatTime, getDisplayTitle } from "../../features/notes/noteUtils";

interface NoteListItemProps {
  note: NoteMetadata;
  isSelected: boolean;
  isHovered: boolean;
  // 分类内的条目使用更紧凑的间距
  inCategory: boolean;
  onSelect: (id: string) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, id: string) => void;
  onHoverChange: (id: string | null) => void;
}

// 侧边栏中的单条笔记卡片，可拖拽到分类
export function NoteListItem({
  note,
  isSelected,
  isHovered,
  inCategory,
  onSelect,
  onContextMenu,
  onHoverChange,
}: NoteListItemProps) {
  const { t } = useTranslation();
  const layoutClass = inCategory ? "rounded-lg mx-1 px-2.5 py-2" : "rounded-xl px-3 py-2.5";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", note.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onSelect(note.id)}
      onContextMenu={(event) => onContextMenu(event, note.id)}
      onMouseEnter={() => onHoverChange(note.id)}
      onMouseLeave={() => onHoverChange(null)}
      className={`w-full text-left ${layoutClass} transition-all duration-[600ms] cursor-pointer group relative ${
        isSelected ? "bg-bamboo-mist/70" : isHovered ? "bg-paper-warm/70" : "bg-transparent"
      }`}
      style={inCategory ? { width: "calc(100% - 8px)" } : undefined}
    >
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-bamboo/60 transition-all duration-[600ms] ${
          isSelected ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />

      <div className="flex items-baseline justify-between mb-0.5">
        <span
          className={`text-[13px] font-display font-medium truncate pr-2 transition-colors ${
            isSelected ? "text-bamboo" : "text-ink-soft"
          }`}
        >
          {getDisplayTitle(note, t)}
        </span>
        <span className="text-[10px] text-ink-ghost font-mono tabular-nums shrink-0">
          {formatShortDate(note.updatedAt)}
        </span>
      </div>

      <p className="text-[11px] text-ink-ghost leading-relaxed line-clamp-2 group-hover:text-ink-faint transition-colors">
        {note.preview || t("common.blankNote", { defaultValue: "空白笔记" })}
      </p>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-ink-ghost/60 font-mono tabular-nums">
          {formatTime(note.updatedAt)}
        </span>
        <span className="text-[10px] text-ink-ghost/40">·</span>
        <span className="text-[10px] text-ink-ghost/60 font-mono tabular-nums">
          {t("common.wordCount", {
            count: note.wordCount,
            defaultValue: "{{count}} 字",
          })}
        </span>
      </div>
    </div>
  );
}
