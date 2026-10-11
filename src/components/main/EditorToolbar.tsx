import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ViewMode } from "../../features/settings/types";
import { SlidingButtonGroup } from "../SlidingButtonGroup";

export function pinTileButtonTitle(isPinned: boolean): string {
  return isPinned ? "取消钉屏" : "钉到屏幕";
}

interface EditorToolbarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  // 当前是否有选中的笔记（无笔记时操作按钮禁用）
  hasNote: boolean;
  tilePinned: boolean;
  onTogglePin: () => void;
  onUndo: () => void;
  onRedo: () => void;
  saveDisabled: boolean;
  onSave: () => void;
  deleteConfirm: boolean;
  onDeleteConfirmChange: (confirm: boolean) => void;
  onDelete: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

// 编辑区顶部工具栏：侧栏开关、钉屏、撤销重做、保存、删除与视图切换
export function EditorToolbar({
  sidebarCollapsed,
  onToggleSidebar,
  hasNote,
  tilePinned,
  onTogglePin,
  onUndo,
  onRedo,
  saveDisabled,
  onSave,
  deleteConfirm,
  onDeleteConfirmChange,
  onDelete,
  viewMode,
  onViewModeChange,
}: EditorToolbarProps) {
  const { t } = useTranslation();
  const [deleteExiting, setDeleteExiting] = useState(false);

  const viewModeOptions = useMemo(
    () => [
      {
        value: "edit" as ViewMode,
        label: t("settings.defaultView.edit", { defaultValue: "编辑" }),
      },
      {
        value: "split" as ViewMode,
        label: t("settings.defaultView.split", { defaultValue: "分栏" }),
      },
      {
        value: "preview" as ViewMode,
        label: t("settings.defaultView.preview", { defaultValue: "预览" }),
      },
    ],
    [t],
  );

  // 播放确认框退出动画后再执行
  const closeDeleteConfirm = (afterClose?: () => void) => {
    setDeleteExiting(true);
    setTimeout(() => {
      setDeleteExiting(false);
      onDeleteConfirmChange(false);
      afterClose?.();
    }, 150);
  };

  return (
    <div className="flex items-center justify-between px-4 h-10 border-b border-paper-deep/20 shrink-0 bg-paper/20">
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSidebar}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer"
          title={
            sidebarCollapsed
              ? t("main.window.expandSidebar", { defaultValue: "展开侧栏" })
              : t("main.window.collapseSidebar", { defaultValue: "收起侧栏" })
          }
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>

        <div className="h-4 w-px bg-paper-deep/30 mx-1" />

        <button
          onClick={onTogglePin}
          disabled={!hasNote}
          aria-label={pinTileButtonTitle(tilePinned)}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
            tilePinned
              ? "text-bamboo bg-bamboo-mist/40 hover:text-red-400 hover:bg-danger-bg"
              : "text-ink-ghost hover:text-bamboo hover:bg-bamboo-mist/50"
          }`}
          title={pinTileButtonTitle(tilePinned)}
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
            <path d="M12 17v5" />
            <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1 1 1 0 0 1 1 1z" />
          </svg>
        </button>

        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={onUndo}
          disabled={!hasNote}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("main.editor.undo", { defaultValue: "撤销（Ctrl+Z）" })}
          aria-label={t("main.editor.undoLabel", { defaultValue: "撤销" })}
        >
          <svg
            data-testid="main-editor-undo-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
          </svg>
        </button>

        <button
          onMouseDown={(event) => event.preventDefault()}
          onClick={onRedo}
          disabled={!hasNote}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("main.editor.redo", { defaultValue: "重做（Ctrl+Y）" })}
          aria-label={t("main.editor.redoLabel", { defaultValue: "重做" })}
        >
          <svg
            data-testid="main-editor-redo-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ transform: "scaleX(-1)" }}
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M4 9h10a6 6 0 0 1 0 12h-1" />
          </svg>
        </button>

        <button
          onClick={onSave}
          disabled={saveDisabled}
          className="px-2.5 h-7 flex items-center justify-center rounded-lg text-[11px] text-ink-ghost hover:text-ink-faint hover:bg-paper-warm transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title={t("common.save", { defaultValue: "保存" })}
        >
          {t("common.save", { defaultValue: "保存" })}
        </button>

        {deleteConfirm ? (
          <div
            className={`flex items-center gap-1 ml-1 ${deleteExiting ? "animate-delete-confirm-exit" : "animate-delete-confirm"}`}
          >
            <span className="text-[11px] text-red-400 whitespace-nowrap">
              {t("main.editor.confirmDelete", { defaultValue: "确认删除？" })}
            </span>
            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => closeDeleteConfirm(onDelete)}
              className="px-2 h-6 rounded-md text-[11px] text-cloud bg-red-400 hover:bg-red-500 transition-colors cursor-pointer whitespace-nowrap outline-none"
            >
              {t("common.delete", { defaultValue: "删除" })}
            </button>
            <button
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => closeDeleteConfirm()}
              className="px-2 h-6 rounded-md text-[11px] text-ink-faint hover:text-ink-soft hover:bg-paper-warm transition-colors cursor-pointer outline-none"
            >
              {t("common.cancel", { defaultValue: "取消" })}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onDeleteConfirmChange(true)}
            disabled={!hasNote}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-ink-ghost hover:text-red-400 hover:bg-danger-bg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title={t("noteMenu.delete", { defaultValue: "删除笔记" })}
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
              <polyline points="3,6 5,6 21,6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        )}
      </div>

      <SlidingButtonGroup
        options={viewModeOptions}
        value={viewMode}
        onChange={onViewModeChange}
        buttonClassName="px-3 py-1"
      />
    </div>
  );
}
