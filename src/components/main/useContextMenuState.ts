import { useCallback, useEffect, useState } from "react";

interface NoteMenuState {
  x: number;
  y: number;
  noteId: string;
}

interface CategoryMenuState {
  x: number;
  y: number;
  category: string;
}

// 关闭动画时长，需与 animate-menu-exit 保持一致
const MENU_EXIT_DURATION_MS = 150;

// 笔记与分类右键菜单的打开/关闭状态：点击外部或按 Esc 关闭，播放退出动画后卸载
export function useContextMenuState() {
  const [noteMenu, setNoteMenu] = useState<NoteMenuState | null>(null);
  const [noteMenuClosing, setNoteMenuClosing] = useState(false);
  const [noteMenuMode, setNoteMenuMode] = useState<"main" | "move">("main");
  const [categoryMenu, setCategoryMenu] = useState<CategoryMenuState | null>(null);
  const [categoryMenuClosing, setCategoryMenuClosing] = useState(false);
  const [categoryMenuConfirmDelete, setCategoryMenuConfirmDelete] = useState(false);
  const [categoryMenuHoverSuppressed, setCategoryMenuHoverSuppressed] = useState(false);

  useEffect(() => {
    function closeMenus() {
      setNoteMenuClosing(true);
      setCategoryMenuClosing(true);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenus();
    }

    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!noteMenuClosing || !noteMenu) return;
    const timer = window.setTimeout(() => {
      setNoteMenu(null);
      setNoteMenuClosing(false);
      setNoteMenuMode("main");
    }, MENU_EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [noteMenuClosing, noteMenu]);

  useEffect(() => {
    if (!categoryMenuClosing || !categoryMenu) return;
    const timer = window.setTimeout(() => {
      setCategoryMenu(null);
      setCategoryMenuClosing(false);
      setCategoryMenuConfirmDelete(false);
      setCategoryMenuHoverSuppressed(false);
    }, MENU_EXIT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [categoryMenuClosing, categoryMenu]);

  // 切换面板后，直到鼠标再次移动前都不显示悬停高亮
  useEffect(() => {
    if (!categoryMenuHoverSuppressed || !categoryMenu) return;
    const releaseHover = () => setCategoryMenuHoverSuppressed(false);
    window.addEventListener("mousemove", releaseHover, { once: true });
    window.addEventListener("mousedown", releaseHover, { once: true });
    return () => {
      window.removeEventListener("mousemove", releaseHover);
      window.removeEventListener("mousedown", releaseHover);
    };
  }, [categoryMenuHoverSuppressed, categoryMenu]);

  const openNoteMenu = useCallback((x: number, y: number, noteId: string) => {
    setNoteMenuClosing(false);
    setNoteMenu({ x, y, noteId });
  }, []);

  const closeNoteMenu = useCallback(() => setNoteMenuClosing(true), []);

  const openCategoryMenu = useCallback((x: number, y: number, category: string) => {
    setCategoryMenu({ x, y, category });
    setCategoryMenuClosing(false);
    setCategoryMenuConfirmDelete(false);
  }, []);

  const closeCategoryMenu = useCallback(() => setCategoryMenuClosing(true), []);

  const switchCategoryMenuPanel = useCallback((confirmDelete: boolean) => {
    setCategoryMenuHoverSuppressed(true);
    setCategoryMenuConfirmDelete(confirmDelete);
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  return {
    noteMenu,
    noteMenuClosing,
    noteMenuMode,
    setNoteMenuMode,
    openNoteMenu,
    closeNoteMenu,
    categoryMenu,
    categoryMenuClosing,
    categoryMenuConfirmDelete,
    categoryMenuHoverSuppressed,
    openCategoryMenu,
    closeCategoryMenu,
    switchCategoryMenuPanel,
  };
}
