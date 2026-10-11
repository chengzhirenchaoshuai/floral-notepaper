import { useState, type DragEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { CategoryGroup } from "../../features/notes/noteUtils";
import type { ExternalFile } from "../../features/notes/types";
import { ExternalFileListItem } from "./ExternalFileListItem";
import { NoteListItem } from "./NoteListItem";

interface NoteSidebarProps {
  width: number;
  collapsed: boolean;
  // 启动阶段关闭宽度过渡动画
  animated: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  noteCount: number;
  externalFiles: ExternalFile[];
  categoryGroups: CategoryGroup[];
  collapsedCategories: Set<string>;
  isLoading: boolean;
  selectedId: string | null;
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
  onNewNote: () => void;
  onImportNote: () => void;
  onSelectNote: (id: string) => void;
  onSelectExternalFile: (id: string) => void;
  onRemoveExternalFile: (id: string) => void;
  onOpenNoteMenu: (event: MouseEvent<HTMLElement>, noteId: string) => void;
  onMoveNote: (noteId: string, category: string) => void;
  onToggleCategoryCollapse: (category: string) => void;
  onOpenCategoryMenu: (event: MouseEvent<HTMLElement>, category: string) => void;
  // 返回是否创建成功（成功或名称为空时收起输入框）
  onCreateCategory: (name: string) => Promise<boolean>;
  renamingCategory: string | null;
  renameCategoryValue: string;
  onRenameCategoryValueChange: (value: string) => void;
  onRenameCategoryCommit: (oldName: string) => void;
  onRenameCategoryCancel: () => void;
}

// 主窗口左侧栏：搜索、新建/导入、分类与笔记列表
export function NoteSidebar({
  width,
  collapsed,
  animated,
  searchQuery,
  onSearchChange,
  noteCount,
  externalFiles,
  categoryGroups,
  collapsedCategories,
  isLoading,
  selectedId,
  hoveredId,
  onHoverChange,
  onNewNote,
  onImportNote,
  onSelectNote,
  onSelectExternalFile,
  onRemoveExternalFile,
  onOpenNoteMenu,
  onMoveNote,
  onToggleCategoryCollapse,
  onOpenCategoryMenu,
  onCreateCategory,
  renamingCategory,
  renameCategoryValue,
  onRenameCategoryValueChange,
  onRenameCategoryCommit,
  onRenameCategoryCancel,
}: NoteSidebarProps) {
  const { t } = useTranslation();
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [categoryInputValue, setCategoryInputValue] = useState("");

  const submitCategory = async () => {
    const name = categoryInputValue.trim();
    if (!name) {
      setShowCategoryInput(false);
      return;
    }
    if (await onCreateCategory(name)) {
      setShowCategoryInput(false);
      setCategoryInputValue("");
    }
  };

  // 分类区域的拖放处理：悬停时高亮，放下时把笔记移入该分类
  const dropZoneHandlers = (category: string) => ({
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverCategory(category);
    },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverCategory(null);
      }
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverCategory(null);
      const noteId = e.dataTransfer.getData("text/plain");
      if (noteId) onMoveNote(noteId, category);
    },
  });

  const renderNote = (note: CategoryGroup["notes"][number], inCategory: boolean) => (
    <NoteListItem
      key={note.id}
      note={note}
      isSelected={note.id === selectedId}
      isHovered={note.id === hoveredId}
      inCategory={inCategory}
      onSelect={onSelectNote}
      onContextMenu={onOpenNoteMenu}
      onHoverChange={onHoverChange}
    />
  );

  return (
    <div
      className={`border-r border-paper-deep/30 bg-paper/40 shrink-0 overflow-hidden ${
        animated ? "transition-[width] duration-[600ms]" : ""
      }`}
      style={{ width: collapsed ? 0 : width }}
    >
      <div className="flex flex-col h-full" style={{ width: `${width}px` }}>
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-paper-warm/80 border border-paper-deep/40 focus-within:border-bamboo/30 focus-within:bg-cloud transition-all">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="text-ink-ghost shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("main.sidebar.searchPlaceholder", { defaultValue: "搜索笔记…" })}
              className="flex-1 text-[12px] font-body text-ink placeholder:text-ink-ghost/60 bg-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="text-ink-ghost hover:text-ink-faint transition-colors cursor-pointer"
                title={t("main.sidebar.clearSearch", { defaultValue: "清空搜索" })}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pb-2 shrink-0 space-y-1">
          <button
            onClick={onNewNote}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-body text-bamboo hover:bg-bamboo-mist/60 transition-all cursor-pointer group"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="group-hover:rotate-90 transition-transform duration-200"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{t("main.sidebar.newNote", { defaultValue: "新建笔记" })}</span>
          </button>
          <button
            onClick={onImportNote}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-body text-ink-faint hover:text-bamboo hover:bg-bamboo-mist/50 transition-all cursor-pointer group"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            <span>{t("main.sidebar.importMarkdown", { defaultValue: "导入 Markdown" })}</span>
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-1.5 shrink-0">
          <span className="text-[10px] text-ink-ghost font-mono tracking-wider uppercase">
            {t("common.noteCount", {
              count: noteCount,
              defaultValue: "{{count}} 篇笔记",
            })}
            {externalFiles.length > 0
              ? ` · ${t("common.externalFileCount", {
                  count: externalFiles.length,
                  defaultValue: "{{count}} 个外部文件",
                })}`
              : ""}
          </span>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (showCategoryInput && categoryInputValue.trim()) {
                void submitCategory();
                return;
              }
              setShowCategoryInput(true);
            }}
            className="text-[10px] text-ink-ghost hover:text-bamboo transition-colors cursor-pointer"
            title={t("main.category.new", { defaultValue: "新建分类" })}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {showCategoryInput && (
          <div className="px-3 pb-2 shrink-0">
            <input
              type="text"
              autoFocus
              value={categoryInputValue}
              onChange={(e) => setCategoryInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submitCategory();
                if (e.key === "Escape") {
                  setShowCategoryInput(false);
                  setCategoryInputValue("");
                }
              }}
              onBlur={() => void submitCategory()}
              placeholder={t("main.category.placeholder", { defaultValue: "输入分类名…" })}
              className="w-full px-2.5 h-7 rounded-lg text-[12px] font-body text-ink bg-paper-warm/80 border border-paper-deep/40 focus:border-bamboo/30 placeholder:text-ink-ghost/60"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-2 pb-2">
          <div className="space-y-0.5">
            {externalFiles.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] text-ink-ghost/50 font-mono tracking-wider uppercase">
                  {t("main.externalFiles.title", { defaultValue: "外部文件" })}
                </div>
                {externalFiles.map((file) => (
                  <ExternalFileListItem
                    key={file.id}
                    file={file}
                    isSelected={file.id === selectedId}
                    isHovered={file.id === hoveredId}
                    onSelect={onSelectExternalFile}
                    onRemove={onRemoveExternalFile}
                    onHoverChange={onHoverChange}
                  />
                ))}
              </>
            )}

            {categoryGroups.map((group) => {
              if (!group.category) {
                return (
                  <div
                    key="__uncategorized__"
                    className={`rounded-lg transition-all duration-200 ${
                      dragOverCategory === "" ? "bg-bamboo/10 ring-1 ring-bamboo/20" : ""
                    }`}
                    {...dropZoneHandlers("")}
                  >
                    {group.notes.map((note) => renderNote(note, false))}
                  </div>
                );
              }

              const isCollapsed = collapsedCategories.has(group.category);
              const headerDrop = dropZoneHandlers(group.category);

              return (
                <div key={group.category} className="px-2 mb-0.5">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg group/cat cursor-pointer select-none transition-all duration-200 ${
                      dragOverCategory === group.category
                        ? "bg-bamboo/15 border border-bamboo/40 ring-1 ring-bamboo/20"
                        : isCollapsed
                          ? "bg-transparent border border-bamboo/15"
                          : "bg-bamboo/8 border border-bamboo/15 rounded-b-none"
                    }`}
                    onClick={() => onToggleCategoryCollapse(group.category)}
                    onContextMenu={(e) => onOpenCategoryMenu(e, group.category)}
                    onDragOver={headerDrop.onDragOver}
                    // 分类标题离开即取消高亮（与内容区不同，不判断子元素）
                    onDragLeave={() => setDragOverCategory(null)}
                    onDrop={headerDrop.onDrop}
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
                      className={`text-bamboo/50 shrink-0 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-bamboo/50 shrink-0"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    {renamingCategory === group.category ? (
                      <input
                        type="text"
                        autoFocus
                        value={renameCategoryValue}
                        onChange={(e) => onRenameCategoryValueChange(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") onRenameCategoryCommit(group.category);
                          if (e.key === "Escape") onRenameCategoryCancel();
                        }}
                        onBlur={() => onRenameCategoryCommit(group.category)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 px-1 text-[10px] font-mono text-ink bg-paper-warm/80 border border-bamboo/30 rounded"
                      />
                    ) : (
                      <span className="text-[11px] text-bamboo/70 font-medium truncate">
                        {group.category}
                      </span>
                    )}
                    <span className="text-[9px] text-bamboo/40 font-mono ml-auto shrink-0">
                      {group.notes.length}
                    </span>
                  </div>

                  <div className={`category-body ${isCollapsed ? "" : "expanded"}`}>
                    <div
                      className="category-body-inner bg-bamboo/[0.03] border border-t-0 border-bamboo/10 rounded-b-lg pb-1 pt-1"
                      {...dropZoneHandlers(group.category)}
                    >
                      {group.notes.length === 0 ? (
                        <div className="px-3 py-3 text-center text-[11px] text-ink-ghost/50">
                          {t("main.category.emptyFolder", { defaultValue: "空文件夹" })}
                        </div>
                      ) : (
                        group.notes.map((note) => renderNote(note, true))
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!isLoading && noteCount === 0 && externalFiles.length === 0 && (
              <div className="px-3 py-8 text-center text-[12px] text-ink-ghost leading-relaxed">
                {searchQuery
                  ? t("main.search.noResults", { defaultValue: "没有匹配的笔记" })
                  : t("main.search.empty", { defaultValue: "还没有笔记" })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
