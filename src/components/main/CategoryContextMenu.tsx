import { useTranslation } from "react-i18next";
import {
  POPUP_VIEWPORT_MARGIN,
  useViewportPopupPosition,
  type PopupPosition,
} from "../popupPosition";

interface CategoryContextMenuProps {
  anchor: PopupPosition;
  category: string;
  closing: boolean;
  // 是否处于“确认删除”面板
  confirmDelete: boolean;
  // 切换面板期间暂时屏蔽悬停高亮
  hoverSuppressed: boolean;
  onRename: () => void;
  onDelete: () => void;
  onSwitchPanel: (confirmDelete: boolean) => void;
}

// 分类右键菜单
export function CategoryContextMenu({
  anchor,
  category,
  closing,
  confirmDelete,
  hoverSuppressed,
  onRename,
  onDelete,
  onSwitchPanel,
}: CategoryContextMenuProps) {
  const { t } = useTranslation();
  const { popupRef, popupPosition } = useViewportPopupPosition(anchor, confirmDelete);

  return (
    <div
      ref={popupRef}
      className={`popup-menu fixed z-[9999] min-w-[140px] py-1.5 bg-cloud/95 backdrop-blur-sm border border-paper-deep/50 rounded-lg overflow-x-hidden overflow-y-auto select-none ${closing ? "animate-menu-exit" : "animate-menu-enter"}`}
      data-hover-suppressed={hoverSuppressed ? "" : undefined}
      style={{
        left: popupPosition?.x ?? anchor.x,
        top: popupPosition?.y ?? anchor.y,
        maxWidth: `calc(100vw - ${POPUP_VIEWPORT_MARGIN * 2}px)`,
        maxHeight: `calc(100vh - ${POPUP_VIEWPORT_MARGIN * 2}px)`,
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {confirmDelete ? (
        <div key="category-confirm" className="animate-menu-slide-left">
          <div className="px-3 py-1.5 text-[11px] font-body text-ink-faint border-b border-paper-deep/20">
            {t("main.category.confirmDelete", {
              category,
              defaultValue: "确认删除「{{category}}」？",
            })}
          </div>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={onDelete}
            className="w-full text-left px-3 py-1.5 text-[12px] font-body text-red-400 hover:bg-danger-bg hover:text-red-500 transition-colors cursor-pointer outline-none"
          >
            {t("main.category.confirmDeleteAction", { defaultValue: "确认删除" })}
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSwitchPanel(false)}
            className="w-full text-left px-3 py-1.5 text-[12px] font-body text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo transition-colors cursor-pointer outline-none"
          >
            {t("common.cancel", { defaultValue: "取消" })}
          </button>
        </div>
      ) : (
        <div key="category-main" className="animate-menu-slide-right">
          <button
            onClick={onRename}
            className="w-full text-left px-3 py-1.5 text-[12px] font-body text-ink-soft hover:bg-bamboo-mist/60 hover:text-bamboo transition-colors cursor-pointer"
          >
            {t("main.category.rename", { defaultValue: "重命名" })}
          </button>
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSwitchPanel(true)}
            className="w-full text-left px-3 py-1.5 text-[12px] font-body text-red-400 hover:bg-danger-bg hover:text-red-500 transition-colors cursor-pointer border-t border-paper-deep/20 outline-none"
          >
            {t("main.category.delete", { defaultValue: "删除分类" })}
          </button>
        </div>
      )}
    </div>
  );
}
