import { useTranslation } from "react-i18next";
import type {
  NoteContextMenuAction,
  NoteContextMenuItem,
} from "../../features/notes/noteContextMenu";
import {
  POPUP_VIEWPORT_MARGIN,
  useViewportPopupPosition,
  type PopupPosition,
} from "../popupPosition";

interface NoteContextMenuProps {
  anchor: PopupPosition;
  closing: boolean;
  // main：操作列表；move：选择目标分类
  mode: "main" | "move";
  items: readonly NoteContextMenuItem[];
  categories: string[];
  onAction: (action: NoteContextMenuAction) => void;
  onBack: () => void;
  onMoveTo: (category: string) => void;
}

// 笔记右键菜单
export function NoteContextMenu({
  anchor,
  closing,
  mode,
  items,
  categories,
  onAction,
  onBack,
  onMoveTo,
}: NoteContextMenuProps) {
  const { t } = useTranslation();
  const { popupRef, popupPosition } = useViewportPopupPosition(
    anchor,
    `${mode}:${categories.length}`,
  );

  return (
    <div
      ref={popupRef}
      className={`popup-menu fixed z-[9999] min-w-[168px] py-1.5 bg-cloud/95 backdrop-blur-sm border border-paper-deep/50 rounded-lg overflow-x-hidden overflow-y-auto select-none ${closing ? "animate-menu-exit" : "animate-menu-enter"}`}
      style={{
        left: popupPosition?.x ?? anchor.x,
        top: popupPosition?.y ?? anchor.y,
        maxWidth: `calc(100vw - ${POPUP_VIEWPORT_MARGIN * 2}px)`,
        maxHeight: `calc(100vh - ${POPUP_VIEWPORT_MARGIN * 2}px)`,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {mode === "main" ? (
        <div key="main" className="animate-menu-slide-right">
          {items.map((item, index) => (
            <button
              key={item.action}
              onClick={() => onAction(item.action)}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-[12px] font-body transition-colors cursor-pointer ${
                item.tone === "danger"
                  ? "text-red-400 hover:bg-danger-bg hover:text-red-500"
                  : "text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo"
              } ${index > 0 ? "border-t border-paper-deep/20" : ""}`}
            >
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div key="move" className="animate-menu-slide-left">
          <button
            onClick={onBack}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-body text-ink-ghost hover:bg-paper-warm transition-colors cursor-pointer border-b border-paper-deep/20"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>{t("common.back", { defaultValue: "返回" })}</span>
          </button>
          <button
            onClick={() => onMoveTo("")}
            className="w-full text-left px-3 py-1.5 text-[12px] font-body text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo transition-colors cursor-pointer"
          >
            {t("main.category.uncategorized", { defaultValue: "未分类" })}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onMoveTo(cat)}
              className="w-full text-left px-3 py-1.5 text-[12px] font-body text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo transition-colors cursor-pointer"
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
