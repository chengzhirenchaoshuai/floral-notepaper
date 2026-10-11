import { useTranslation } from "react-i18next";
import type { ExternalFile } from "../../features/notes/types";

interface ExternalFileListItemProps {
  file: ExternalFile;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onHoverChange: (id: string | null) => void;
}

// 侧边栏中打开的外部 Markdown 文件条目
export function ExternalFileListItem({
  file,
  isSelected,
  isHovered,
  onSelect,
  onRemove,
  onHoverChange,
}: ExternalFileListItemProps) {
  const { t } = useTranslation();

  return (
    <button
      onClick={() => onSelect(file.id)}
      onMouseEnter={() => onHoverChange(file.id)}
      onMouseLeave={() => onHoverChange(null)}
      className={`w-full text-left rounded-xl px-3 py-2.5 transition-all duration-[600ms] cursor-pointer group relative ${
        isSelected ? "bg-bamboo-mist/70" : isHovered ? "bg-paper-warm/70" : "bg-transparent"
      }`}
    >
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full bg-bamboo/60 transition-all duration-[600ms] ${
          isSelected ? "h-5 opacity-100" : "h-0 opacity-0"
        }`}
      />

      <div className="flex items-baseline justify-between mb-0.5">
        <span
          className={`text-[13px] font-display font-medium truncate pr-2 transition-colors flex items-center gap-1.5 ${
            isSelected ? "text-bamboo" : "text-ink-soft"
          }`}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 opacity-60"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          {file.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file.id);
          }}
          className="opacity-0 group-hover:opacity-100 text-ink-ghost hover:text-red-400 transition-all p-0.5"
          title={t("main.externalFiles.remove", {
            defaultValue: "从列表移除",
          })}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <p className="text-[11px] text-ink-ghost leading-relaxed line-clamp-2 group-hover:text-ink-faint transition-colors pl-[18px]">
        {file.filePath}
      </p>
    </button>
  );
}
