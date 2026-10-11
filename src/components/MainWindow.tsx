import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
  lazy,
} from "react";
import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exportMarkdownNote, importMarkdownNote } from "../features/importExport/api";
import { MarkdownPreviewLazy as MarkdownPreview } from "../features/markdown/MarkdownPreviewLazy";
import { showToast } from "./Toast";
import {
  chooseDataDirectory,
  getConfig,
  migrateDataDir,
  normalizeViewMode,
  saveConfig,
} from "../features/settings/api";
import type { AppConfig, ViewMode } from "../features/settings/types";
import { normalizeTileColor } from "../features/settings/tileColor";
import { reportInstallPreparation } from "../features/update/api";
import type { UpdateInstallPrepareRequest } from "../features/update/types";
import { BackgroundLayer } from "./BackgroundLayer";
import { MainTitleBar } from "./main/MainTitleBar";
import { NoteSidebar } from "./main/NoteSidebar";
import { EditorToolbar } from "./main/EditorToolbar";
import { FormatToolbar } from "./main/FormatToolbar";
import { NoteHeader, type SaveState } from "./main/NoteHeader";
import { EditorStatusBar } from "./main/EditorStatusBar";
import { NoteContextMenu } from "./main/NoteContextMenu";
import { CategoryContextMenu } from "./main/CategoryContextMenu";
import { useAboutUpdateReminder } from "../features/update/useAboutUpdateReminder";
import { useDragResize } from "./main/useDragResize";
import { useEditorPreviewScrollSync } from "../features/markdown/useEditorPreviewScrollSync";
import {
  createNote,
  createCategory,
  deleteCategory,
  deleteNote,
  getErrorMessage,
  getFileModifiedTime,
  getNote,
  listCategories,
  listNotes,
  moveNoteCategory,
  readExternalFile,
  renameCategory,
  saveExternalFile,
  updateNote,
} from "../features/notes/api";
import { cleanUnusedImages, pickLocalImages, saveImageFromPath } from "../features/images/api";
import { useImagePaste, insertTextAtCursor } from "../features/images/useImagePaste";
import { useImageBaseDir } from "../features/images/useImageBaseDir";
import { applyFormat, runEditorCommand } from "../features/editor/formatting";
import { useLoadEpoch } from "../features/notes/useLoadEpoch";
import type { ExternalFile, Note, NoteMetadata } from "../features/notes/types";
import {
  countNoteChars,
  filterNotes,
  formatShortDate,
  formatTime,
  groupNotesByCategory,
  metadataFromNote,
} from "../features/notes/noteUtils";
import {
  getNoteContextMenuItems,
  type NoteContextMenuAction,
} from "../features/notes/noteContextMenu";
import {
  appReady,
  openNotepadWindow,
  takeStartupFile,
  toggleTileWindow,
} from "../features/windows/api";
import {
  TILE_WINDOW_CLOSED_EVENT,
  TILE_WINDOW_UNPINNED_EVENT,
  syncPinnedTileIds,
} from "../features/windows/tileWindowEvents";

type SidePanelMode = "about" | "settings";

// 侧面板只在用户主动打开时挂载，懒加载可把关于面板（贡献者数据、更新设置）
// 和设置面板从首屏 bundle 中拆出
const AboutPanel = lazy(() =>
  import("./AboutPanel").then((module) => ({ default: module.AboutPanel })),
);
const SettingsPanel = lazy(() =>
  import("./SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);

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

interface MainWindowProps {
  initialSettingsOpen?: boolean;
  initialConfig?: AppConfig;
}

export function MainWindow({
  initialSettingsOpen = false,
  initialConfig = undefined,
}: MainWindowProps = {}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<NoteMetadata[]>([]);
  const [externalFiles, setExternalFiles] = useState<ExternalFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(
    normalizeViewMode(initialConfig?.defaultViewMode ?? "split"),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // 启动阶段关闭侧栏过渡动画，避免"先展开再收起"的动画被用户看到
  const [sidebarAnimated, setSidebarAnimated] = useState(false);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noteMenu, setNoteMenu] = useState<NoteMenuState | null>(null);
  const [noteMenuClosing, setNoteMenuClosing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mountedSidePanel, setMountedSidePanel] = useState<SidePanelMode | null>(
    initialSettingsOpen && initialConfig ? "settings" : null,
  );
  const [sidePanelContentVisible, setSidePanelContentVisible] = useState(
    Boolean(initialSettingsOpen && initialConfig),
  );
  const { aboutUpdateReminder, dismissReminderText } = useAboutUpdateReminder();
  const [settingsConfig, setSettingsConfig] = useState<AppConfig | null>(initialConfig ?? null);
  const [savedDataDir, setSavedDataDir] = useState<string | null>(initialConfig?.dataDir ?? null);
  const [noteTransitionKey, setNoteTransitionKey] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [pinnedTileIds, setPinnedTileIds] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<string[]>([]);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [noteMenuMode, setNoteMenuMode] = useState<"main" | "move">("main");
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState("");
  const [settingsOverlay, setSettingsOverlay] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1080 : true,
  );
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [categoryMenu, setCategoryMenu] = useState<CategoryMenuState | null>(null);
  const [categoryMenuClosing, setCategoryMenuClosing] = useState(false);
  const [categoryMenuConfirmDelete, setCategoryMenuConfirmDelete] = useState(false);
  const [categoryMenuHoverSuppressed, setCategoryMenuHoverSuppressed] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const windowLabelRef = useRef("main");
  const externalFileMtimeRef = useRef<number>(0);
  const lastExternalSaveRef = useRef<number>(0);
  const imageBaseDir = useImageBaseDir();
  const saveStateRef = useRef(saveState);
  saveStateRef.current = saveState;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const contentValueRef = useRef(content);
  contentValueRef.current = content;
  const titleValueRef = useRef(title);
  titleValueRef.current = title;
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const externalFilesRef = useRef(externalFiles);
  externalFilesRef.current = externalFiles;
  // 每次"应用/切换当前笔记"都会自增；异步加载完成后若 epoch 已变化，说明用户
  // 已切换到别处，该次结果直接丢弃，避免旧的加载结果覆盖新选中的笔记
  const loadEpoch = useLoadEpoch();
  // 串行化所有保存请求，避免自动保存与切换触发的保存并发写同一篇笔记
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedId) ?? null,
    [notes, selectedId],
  );
  const selectedNoteRef = useRef(selectedNote);
  selectedNoteRef.current = selectedNote;

  const selectedExternalFile = useMemo(
    () => externalFiles.find((f) => f.id === selectedId) ?? null,
    [externalFiles, selectedId],
  );

  const isExternal = selectedExternalFile !== null;
  const isExternalRef = useRef(isExternal);
  isExternalRef.current = isExternal;

  // 外部 md 文件里的相对路径图片，按该文件所在目录解析
  const externalFileDir = useMemo(() => {
    if (!selectedExternalFile) return undefined;
    const normalized = selectedExternalFile.filePath.replace(/\\/g, "/");
    const idx = normalized.lastIndexOf("/");
    return idx >= 0 ? normalized.slice(0, idx) : undefined;
  }, [selectedExternalFile]);

  const noteMenuTarget = useMemo(
    () => notes.find((note) => note.id === noteMenu?.noteId) ?? null,
    [noteMenu?.noteId, notes],
  );
  const noteContextMenuItems = useMemo(() => getNoteContextMenuItems(t), [t]);
  const visibleSidePanel: SidePanelMode | null = aboutOpen
    ? "about"
    : settingsOpen && settingsConfig
      ? "settings"
      : null;
  const sidePanelExpanded = visibleSidePanel !== null;

  const filteredNotes = useMemo(() => filterNotes(notes, searchQuery), [notes, searchQuery]);

  const categoryGroups = useMemo(
    () => groupNotesByCategory(filteredNotes, categories),
    [filteredNotes, categories],
  );

  // 打字时输入框优先响应：预览渲染与字数/字节统计使用延迟值，
  // 连续输入期间 React 会自动合并这些重计算，停顿时再追上
  const deferredContent = useDeferredValue(content);

  const lineCount = useMemo(() => deferredContent.split("\n").length, [deferredContent]);
  const byteSize = useMemo(
    () => (new TextEncoder().encode(deferredContent).length / 1024).toFixed(1),
    [deferredContent],
  );
  const charCount = useMemo(() => countNoteChars(deferredContent), [deferredContent]);

  const applyNote = useCallback(
    (note: Note) => {
      // 立刻同步各 ref，保证保存快照与守卫在下一次渲染前就能读到最新值
      loadEpoch.bump();
      selectedIdRef.current = note.id;
      titleValueRef.current = note.title;
      contentValueRef.current = note.content;
      saveStateRef.current = "saved";
      setSelectedId(note.id);
      setTitle(note.title);
      setContent(note.content);
      setSaveState("saved");
      setNoteTransitionKey((k) => k + 1);
    },
    [loadEpoch],
  );

  const replaceNoteMetadata = useCallback((note: Note) => {
    const metadata = metadataFromNote(note);
    setNotes((current) => {
      const exists = current.some((item) => item.id === metadata.id);
      const next = exists
        ? current.map((item) => (item.id === metadata.id ? metadata : item))
        : [metadata, ...current];
      return [...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
  }, []);

  const loadNote = useCallback(
    async (id: string) => {
      const epoch = loadEpoch.bump();
      const note = await getNote(id);
      // 加载期间用户又切换/加载了别的笔记，丢弃本次结果
      if (!loadEpoch.isCurrent(epoch)) return;
      applyNote(note);
      replaceNoteMetadata(note);
    },
    [applyNote, replaceNoteMetadata, loadEpoch],
  );

  const refreshNotes = useCallback(async () => {
    const [loadedNotes, loadedCategories] = await Promise.all([listNotes(), listCategories()]);
    setNotes(loadedNotes);
    setCategories(loadedCategories);
    return loadedNotes;
  }, []);

  const clearCurrentNote = useCallback(() => {
    loadEpoch.bump();
    selectedIdRef.current = null;
    titleValueRef.current = "";
    contentValueRef.current = "";
    saveStateRef.current = "idle";
    setSelectedId(null);
    setTitle("");
    setContent("");
    setSaveState("idle");
  }, [loadEpoch]);

  const loadExternalFile = useCallback(
    async (filePath: string) => {
      const epoch = loadEpoch.bump();
      try {
        const [fileContent, mtime] = await Promise.all([
          readExternalFile(filePath),
          getFileModifiedTime(filePath),
        ]);
        const fileName = filePath.split(/[\\/]/).pop() ?? filePath;
        const displayTitle = fileName.replace(/\.(md|txt)$/i, "");

        setExternalFiles((current) => {
          if (current.some((f) => f.id === filePath)) {
            return current;
          }
          return [
            ...current,
            {
              id: filePath,
              title: displayTitle,
              filePath,
            },
          ];
        });

        if (!loadEpoch.isCurrent(epoch)) return;
        selectedIdRef.current = filePath;
        titleValueRef.current = displayTitle;
        contentValueRef.current = fileContent;
        saveStateRef.current = "saved";
        setSelectedId(filePath);
        setTitle(displayTitle);
        setContent(fileContent);
        setSaveState("saved");
        setNoteTransitionKey((k) => k + 1);
        externalFileMtimeRef.current = mtime;
      } catch (error) {
        showToast(getErrorMessage(error));
      }
    },
    [loadEpoch],
  );

  useEffect(() => {
    try {
      windowLabelRef.current = getCurrentWindow().label;
    } catch {
      windowLabelRef.current = "main";
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      try {
        const [loadedConfig, loadedNotes, loadedCategories] = await Promise.all([
          getConfig(),
          listNotes(),
          listCategories(),
        ]);
        if (cancelled) return;
        setSettingsConfig(loadedConfig);
        setSavedDataDir(loadedConfig.dataDir);
        setViewMode(normalizeViewMode(loadedConfig.defaultViewMode));
        if (loadedConfig.collapseSidebarOnStartup) {
          setSidebarCollapsed(true);
        }
        setNotes(loadedNotes);
        setCategories(loadedCategories);
        setCollapsedCategories(new Set(loadedCategories));
        if (loadedNotes[0]) {
          const note = await getNote(loadedNotes[0].id);
          if (!cancelled) applyNote(note);
        } else {
          clearCurrentNote();
        }

        if (!cancelled) {
          const startupFile = await takeStartupFile();
          if (!cancelled && startupFile) {
            await loadExternalFile(startupFile);
          }
        }
      } catch (error) {
        if (!cancelled) showToast(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          // 等首屏（侧边栏收起状态等初始设置）真正绘制完成后再显示主窗口，
          // 避免窗口先以默认状态露出一瞬间、再跳变成配置里的状态
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (cancelled) return;
              void appReady().catch(() => undefined);
              // 窗口显示后再开启侧栏宽度过渡动画，启动时的收起是瞬间完成的
              setSidebarAnimated(true);
            });
          });
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyNote, clearCurrentNote]);

  useEffect(() => {
    if (visibleSidePanel) {
      setMountedSidePanel(visibleSidePanel);
      setSidePanelContentVisible(false);

      const frame = window.requestAnimationFrame(() => {
        setSidePanelContentVisible(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setSidePanelContentVisible(false);
    if (!mountedSidePanel) return;

    const timer = window.setTimeout(() => {
      setMountedSidePanel((current) => (current === mountedSidePanel ? null : current));
    }, 320);

    return () => window.clearTimeout(timer);
  }, [mountedSidePanel, visibleSidePanel]);

  useEffect(() => {
    const unlisten = listen("notes-changed", () => {
      // 记录事件到达时的 epoch；其间用户一旦切换/加载了笔记，本次同步即过期，
      // 不再用过期的列表快照去改选中或回填内容，避免把选中"拉回"刚保存的旧笔记
      const epochAtEvent = loadEpoch.peek();
      const isStale = () => !loadEpoch.isCurrent(epochAtEvent);
      void refreshNotes()
        .then((loaded) => {
          if (isStale()) return;
          const currentId = selectedIdRef.current;
          if (!currentId) return;
          const stillExists = loaded.some((n) => n.id === currentId);
          if (stillExists) {
            if (saveStateRef.current !== "dirty" && saveStateRef.current !== "saving") {
              void getNote(currentId)
                .then((note) => {
                  if (isStale()) return;
                  if (selectedIdRef.current !== currentId) return;
                  if (saveStateRef.current === "dirty" || saveStateRef.current === "saving") {
                    return;
                  }
                  titleValueRef.current = note.title;
                  contentValueRef.current = note.content;
                  saveStateRef.current = "saved";
                  setTitle(note.title);
                  setContent(note.content);
                  setSaveState("saved");
                })
                .catch(() => undefined);
            }
          } else if (selectedNoteRef.current) {
            if (loaded[0]) {
              void loadNote(loaded[0].id);
            } else {
              clearCurrentNote();
            }
          }
        })
        .catch(() => undefined);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refreshNotes, loadNote, clearCurrentNote, loadEpoch]);

  useEffect(() => {
    function handleFocus() {
      void refreshNotes();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshNotes]);

  useEffect(() => {
    const onResize = () => setSettingsOverlay(window.innerWidth < 1080);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("open-external-file", (event) => {
      void loadExternalFile(event.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [loadExternalFile]);

  useEffect(() => {
    const TEXT_RE = /\.(md|markdown|txt)$/i;
    const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type !== "drop") return;
      const textPaths: string[] = [];
      const imagePaths: string[] = [];

      for (const p of event.payload.paths) {
        if (TEXT_RE.test(p)) textPaths.push(p);
        else if (IMAGE_RE.test(p)) imagePaths.push(p);
      }

      for (const p of textPaths) {
        void loadExternalFile(p);
      }

      if (imagePaths.length > 0 && selectedIdRef.current && !isExternalRef.current) {
        const noteId = selectedIdRef.current;
        void (async () => {
          const textarea = contentRef.current;
          if (!textarea) return;
          try {
            const rels = await Promise.all(imagePaths.map((p) => saveImageFromPath(noteId, p)));
            const markdown = rels.map((rel) => `![](${rel})`).join("\n");
            insertTextAtCursor(textarea, setContent, markdown);
            saveStateRef.current = "dirty";
            setSaveState("dirty");
          } catch (error) {
            showToast(getErrorMessage(error));
          }
        })();
      }
    });

    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [loadExternalFile, setContent]);

  useEffect(() => {
    const unlisten = listen<string>("open-note", (event) => {
      void loadNote(event.payload);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [loadNote]);

  useEffect(() => {
    const unlisten = listen<string>("shortcut-register-failed", (event) => {
      showToast(event.payload, "warning");
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>(TILE_WINDOW_CLOSED_EVENT, (event) => {
      setPinnedTileIds((previous) => syncPinnedTileIds(previous, event.payload, false));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>(TILE_WINDOW_UNPINNED_EVENT, (event) => {
      setPinnedTileIds((previous) => syncPinnedTileIds(previous, event.payload, false));
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!selectedExternalFile) return;

    const interval = window.setInterval(async () => {
      // 窗口隐藏（托盘/最小化）时跳过探测，恢复可见后 1s 内自动追上
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastExternalSaveRef.current < 2000) return;
      try {
        const mtime = await getFileModifiedTime(selectedExternalFile.filePath);
        if (selectedIdRef.current !== selectedExternalFile.id) return;
        if (mtime !== externalFileMtimeRef.current) {
          externalFileMtimeRef.current = mtime;
          const fileContent = await readExternalFile(selectedExternalFile.filePath);
          if (selectedIdRef.current !== selectedExternalFile.id) return;
          contentValueRef.current = fileContent;
          saveStateRef.current = "saved";
          setContent(fileContent);
          setSaveState("saved");
        }
      } catch {
        // file may have been deleted or become inaccessible
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [selectedExternalFile]);

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
    }, 150);
    return () => window.clearTimeout(timer);
  }, [noteMenuClosing, noteMenu]);

  useEffect(() => {
    if (!categoryMenuClosing || !categoryMenu) return;
    const timer = window.setTimeout(() => {
      setCategoryMenu(null);
      setCategoryMenuClosing(false);
      setCategoryMenuConfirmDelete(false);
      setCategoryMenuHoverSuppressed(false);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [categoryMenuClosing, categoryMenu]);

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

  const switchCategoryMenuPanel = useCallback((confirmDelete: boolean) => {
    setCategoryMenuHoverSuppressed(true);
    setCategoryMenuConfirmDelete(confirmDelete);
    (document.activeElement as HTMLElement | null)?.blur();
  }, []);

  const performSave = useCallback(
    async (force: boolean): Promise<boolean> => {
      // 非强制保存（自动保存、切换前保存）在没有未保存修改时直接视为成功
      if (!force && saveStateRef.current !== "dirty") return true;
      const id = selectedIdRef.current;
      if (!id) return false;

      // 在保存瞬间对当前笔记做快照；之后用户切换笔记不影响本次写入的内容，
      // 保存完成后也只在"仍停留在这篇笔记"时才更新保存状态
      const titleSnapshot = titleValueRef.current;
      const contentSnapshot = contentValueRef.current;
      const stillCurrent = () => selectedIdRef.current === id;
      const settleSaveState = (state: SaveState) => {
        if (!stillCurrent()) return;
        saveStateRef.current = state;
        setSaveState(state);
      };

      const externalFile = externalFilesRef.current.find((file) => file.id === id) ?? null;

      settleSaveState("saving");
      try {
        if (externalFile) {
          await saveExternalFile(externalFile.filePath, contentSnapshot);
          lastExternalSaveRef.current = Date.now();
          const mtime = await getFileModifiedTime(externalFile.filePath);
          if (stillCurrent()) {
            externalFileMtimeRef.current = mtime;
          }
          settleSaveState(contentValueRef.current === contentSnapshot ? "saved" : "dirty");
        } else {
          const category = notesRef.current.find((note) => note.id === id)?.category ?? "";
          const note = await updateNote(id, {
            title: titleSnapshot,
            content: contentSnapshot,
            category,
          });
          replaceNoteMetadata(note);
          const contentChanged =
            contentValueRef.current !== contentSnapshot || titleValueRef.current !== titleSnapshot;
          settleSaveState(contentChanged ? "dirty" : "saved");
        }
        return true;
      } catch (error) {
        settleSaveState("error");
        showToast(getErrorMessage(error));
        return false;
      }
    },
    [replaceNoteMetadata],
  );

  const saveCurrentNote = useCallback(
    (force = false): Promise<boolean> => {
      const run = saveQueueRef.current.then(() => performSave(force));
      saveQueueRef.current = run.catch(() => undefined);
      return run;
    },
    [performSave],
  );

  useEffect(() => {
    const unlisten = listen<UpdateInstallPrepareRequest>("update://prepare-install", (event) => {
      const respond = async () => {
        const windowLabel = windowLabelRef.current;
        // 无未保存修改时直接上报就绪：避免排进 saveQueueRef，被正在执行的
        // 防抖自动保存拖住、不必要地延迟安装准备响应
        if (saveStateRef.current !== "dirty") {
          await reportInstallPreparation(event.payload.requestId, windowLabel, "ready");
          return;
        }
        const saved = await saveCurrentNote();
        await reportInstallPreparation(
          event.payload.requestId,
          windowLabel,
          saved ? "ready" : "failed",
          saved
            ? undefined
            : t("settings.update.error.installSaveFailed", {
                defaultValue: "安装前自动保存失败，请先处理当前笔记后重试",
              }),
        );
      };

      void respond().catch(async (error) => {
        await reportInstallPreparation(
          event.payload.requestId,
          windowLabelRef.current,
          "failed",
          error instanceof Error
            ? error.message
            : t("settings.update.error.installSaveFailed", {
                defaultValue: "安装前自动保存失败，请先处理当前笔记后重试",
              }),
        ).catch(() => undefined);
      });
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [saveCurrentNote, t]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        void saveCurrentNote(true);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [saveCurrentNote]);

  useEffect(() => {
    if (!selectedId || saveState !== "dirty") return undefined;
    if (isExternal) {
      if (!settingsConfig?.externalFileAutoSave) return undefined;
    } else {
      if (!settingsConfig?.noteAutoSave) return undefined;
    }

    const timer = window.setTimeout(() => {
      void saveCurrentNote();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [
    // content 与 title 用于在持续输入时不断重置防抖计时器
    content,
    title,
    isExternal,
    saveCurrentNote,
    saveState,
    selectedId,
    settingsConfig?.noteAutoSave,
    settingsConfig?.externalFileAutoSave,
  ]);

  const handleNewNote = async () => {
    await saveCurrentNote();
    try {
      const note = await createNote({ title: "", content: "", category: activeCategory });
      replaceNoteMetadata(note);
      applyNote(note);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleOpenSettings = async () => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    setSettingsOpen(true);
    setAboutOpen(false);
    if (settingsConfig) return;
    try {
      const config = await getConfig();
      setSettingsConfig(config);
      setSavedDataDir(config.dataDir);
      setViewMode(normalizeViewMode(config.defaultViewMode));
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleMigrateDataDir = async () => {
    if (!settingsConfig) return;
    try {
      const dir = await chooseDataDirectory();
      if (!dir) return;
      // 后端会在所选目录下创建 floral 子目录存放数据；先告知用户，
      // 避免其在文件管理器打开所选目录看到"空文件夹"而误判数据丢失
      const confirmed = window.confirm(
        t("settings.dataDir.confirmSubdir", {
          dir,
          defaultValue: "数据将存放在「{{dir}}」下的 floral 子文件夹中，是否继续？",
        }),
      );
      if (!confirmed) return;
      const savedConfig = await migrateDataDir(dir);
      setSettingsConfig(savedConfig);
      setSavedDataDir(savedConfig.dataDir);
      const loadedNotes = await refreshNotes();
      if (loadedNotes[0]) {
        await loadNote(loadedNotes[0].id);
      } else {
        clearCurrentNote();
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const settingsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSettings = useCallback(
    (nextConfig: AppConfig) => {
      if (settingsSaveTimer.current) {
        clearTimeout(settingsSaveTimer.current);
      }
      settingsSaveTimer.current = setTimeout(async () => {
        const previousDataDir = savedDataDir ?? nextConfig.dataDir;
        const normalizedConfig = {
          ...nextConfig,
          defaultViewMode: normalizeViewMode(nextConfig.defaultViewMode),
          tileColor: normalizeTileColor(nextConfig.tileColor),
        };
        try {
          const savedConfig = await saveConfig(normalizedConfig);
          setSettingsConfig(savedConfig);
          setSavedDataDir(savedConfig.dataDir);
          setViewMode(normalizeViewMode(savedConfig.defaultViewMode));

          if (savedConfig.dataDir !== previousDataDir) {
            const loadedNotes = await refreshNotes();
            if (loadedNotes[0]) {
              await loadNote(loadedNotes[0].id);
            } else {
              clearCurrentNote();
            }
          }
        } catch (error) {
          showToast(getErrorMessage(error));
        }
      }, 300);
    },
    [savedDataDir, refreshNotes, loadNote, clearCurrentNote],
  );

  const handleSettingsChange = useCallback(
    (nextConfig: AppConfig) => {
      setSettingsConfig(nextConfig);
      persistSettings(nextConfig);
    },
    [persistSettings],
  );

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleOpenAbout = useCallback(() => {
    setAboutOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) {
        setSettingsOpen(false);
        dismissReminderText();
      }
      return nextOpen;
    });
  }, [dismissReminderText]);

  const handleCloseAbout = useCallback(() => {
    setAboutOpen(false);
  }, []);

  const handleImportNote = async () => {
    try {
      const saved = await saveCurrentNote();
      if (!saved) return;

      const note = await importMarkdownNote(activeCategory);
      if (!note) return;

      replaceNoteMetadata(note);
      applyNote(note);
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleSelectNote = async (id: string) => {
    if (id === selectedId) return;
    setDeleteConfirm(false);
    // 排队保存：等待可能在途的自动保存，并把尚未落盘的修改一并存掉
    await saveCurrentNote();

    setIsLoading(true);
    try {
      await loadNote(id);
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectExternalFile = async (id: string) => {
    if (id === selectedId) return;
    setDeleteConfirm(false);
    await saveCurrentNote();

    const file = externalFiles.find((f) => f.id === id);
    if (!file) return;

    setIsLoading(true);
    const epoch = loadEpoch.bump();
    try {
      const [fileContent, mtime] = await Promise.all([
        readExternalFile(file.filePath),
        getFileModifiedTime(file.filePath),
      ]);
      if (!loadEpoch.isCurrent(epoch)) return;
      selectedIdRef.current = id;
      titleValueRef.current = file.title;
      contentValueRef.current = fileContent;
      saveStateRef.current = "saved";
      setSelectedId(id);
      setTitle(file.title);
      setContent(fileContent);
      setSaveState("saved");
      setNoteTransitionKey((k) => k + 1);
      externalFileMtimeRef.current = mtime;
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveExternalFile = async (id: string) => {
    if (selectedId === id && saveState === "dirty") {
      const shouldSave = window.confirm(
        t("main.confirm.unsavedExternalFile", {
          title: title || t("common.untitledFile", { defaultValue: "未命名文件" }),
          defaultValue: "「{{title}}」有未保存的更改，是否保存到原文件？",
        }),
      );
      if (shouldSave) {
        const saved = await saveCurrentNote();
        if (!saved) return;
      }
    }
    setExternalFiles((current) => current.filter((f) => f.id !== id));
    if (selectedId === id) {
      clearCurrentNote();
    }
  };

  const handleDeleteNote = async (noteId = selectedId) => {
    if (!noteId) return;

    setDeleteConfirm(false);
    try {
      await deleteNote(noteId);
      const remaining = await refreshNotes();
      if (noteId === selectedId && remaining[0]) {
        await loadNote(remaining[0].id);
      } else if (noteId === selectedId) {
        clearCurrentNote();
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleOpenNoteMenu = (event: MouseEvent<HTMLElement>, noteId: string) => {
    event.preventDefault();
    event.stopPropagation();

    setNoteMenuClosing(false);
    setHoveredId(noteId);
    setNoteMenu({
      x: event.clientX,
      y: event.clientY,
      noteId,
    });
  };

  const handleExportNote = async (note: NoteMetadata) => {
    try {
      if (note.id === selectedId) {
        const saved = await saveCurrentNote();
        if (!saved) return;
      }

      await exportMarkdownNote({
        id: note.id,
        title: note.id === selectedId ? title : note.title,
      });
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleNoteMenuAction = (action: NoteContextMenuAction) => {
    const note = noteMenuTarget;
    if (!note) return;

    if (action === "export") {
      setNoteMenuClosing(true);
      void handleExportNote(note);
      return;
    }

    if (action === "move") {
      setNoteMenuMode("move");
      return;
    }

    setNoteMenuClosing(true);
    void handleDeleteNote(note.id);
  };

  const handleMoveNote = async (noteId: string, targetCategory: string) => {
    setNoteMenuClosing(true);
    try {
      await moveNoteCategory(noteId, targetCategory);
      await refreshNotes();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleCreateCategory = async (name: string): Promise<boolean> => {
    try {
      await createCategory(name);
      setCategories((prev) => [...prev, name].sort());
      return true;
    } catch (error) {
      showToast(getErrorMessage(error));
      return false;
    }
  };

  const handleOpenCategoryMenu = (event: MouseEvent<HTMLElement>, category: string) => {
    event.preventDefault();
    event.stopPropagation();
    setCategoryMenu({ x: event.clientX, y: event.clientY, category });
    setCategoryMenuClosing(false);
    setCategoryMenuConfirmDelete(false);
  };

  const handleRenameCategory = async (oldName: string) => {
    const newName = renameCategoryValue.trim();
    if (!newName || newName === oldName) {
      setRenamingCategory(null);
      return;
    }

    try {
      await renameCategory(oldName, newName);
      await refreshNotes();
      setRenamingCategory(null);
      setRenameCategoryValue("");
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleDeleteCategory = async (name: string) => {
    try {
      await deleteCategory(name);
      await refreshNotes();
      if (activeCategory === name) {
        setActiveCategory("");
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const markDirty = () => {
    if (!selectedId) return;
    saveStateRef.current = "dirty";
    setSaveState("dirty");
  };

  const ensureNoteSaved = useCallback(async (): Promise<string | null> => {
    if (selectedId) return selectedId;
    try {
      const note = await createNote({ title, content, category: activeCategory });
      replaceNoteMetadata(note);
      applyNote(note);
      return note.id;
    } catch {
      return null;
    }
  }, [selectedId, title, content, activeCategory, replaceNoteMetadata, applyNote]);

  const {
    handlePaste: imagePasteHandler,
    handleDrop: imageDropHandler,
    handleDragOver: imageDragOverHandler,
  } = useImagePaste({
    noteId: selectedId,
    textareaRef: contentRef,
    setContent,
    markDirty,
    onEnsureNoteSaved: ensureNoteSaved,
    disabled: isExternal,
    onError: showToast,
    t,
  });

  const handleCleanUnusedImages = async () => {
    if (!selectedId || isExternal) return;
    try {
      const removed = await cleanUnusedImages(selectedId, content);
      if (removed.length > 0) {
        showToast(
          t("main.images.cleaned", {
            count: removed.length,
            defaultValue: "已清理 {{count}} 张图片",
          }),
          "info",
        );
      } else {
        showToast(t("main.images.cleanedNone", { defaultValue: "没有需要清理的图片" }), "info");
      }
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleInsertLocalImage = async () => {
    if (isExternal) return;
    try {
      const paths = await pickLocalImages();
      if (paths.length === 0) return;

      const noteId = await ensureNoteSaved();
      if (!noteId) return;

      const textarea = contentRef.current;
      if (!textarea) return;

      const rels = await Promise.all(paths.map((p) => saveImageFromPath(noteId, p)));
      const markdown = rels.map((rel) => `![](${rel})`).join("\n");
      insertTextAtCursor(textarea, setContent, markdown);
      markDirty();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const handleUndo = () => {
    if (!selectedId) return;
    const textarea = contentRef.current;
    if (runEditorCommand(textarea, "undo")) {
      setContent(textarea?.value ?? content);
      markDirty();
    }
  };

  const handleRedo = () => {
    if (!selectedId) return;
    const textarea = contentRef.current;
    if (runEditorCommand(textarea, "redo")) {
      setContent(textarea?.value ?? content);
      markDirty();
    }
  };

  const handleOpenNotepad = async () => {
    try {
      await openNotepadWindow();
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  useDragResize(isResizingSidebar, setIsResizingSidebar, (e) => {
    setSidebarWidth(Math.min(Math.max(e.clientX, 180), 500));
  });

  useDragResize(isResizingSplit, setIsResizingSplit, (e) => {
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setSplitRatio(Math.min(Math.max(ratio, 0.2), 0.8));
  });

  const { previewScrollRef, handleEditorScroll, handlePreviewScroll } = useEditorPreviewScrollSync({
    contentRef,
    splitContainerRef,
    viewMode,
    enabled: settingsConfig?.splitScrollSync ?? true,
    content,
    selectedId,
    fontSize: settingsConfig?.fontSize,
    renderHtmlMarkdown: settingsConfig?.renderHtmlMarkdown,
    splitRatio,
  });

  const handlePinEntry = async () => {
    if (!selectedId) return;
    const isPinned = pinnedTileIds.has(selectedId);
    if (!isPinned) {
      await saveCurrentNote();
    }
    try {
      const pinned = await toggleTileWindow(selectedId);
      setPinnedTileIds((previous) => {
        return syncPinnedTileIds(previous, selectedId, pinned);
      });
    } catch (error) {
      showToast(getErrorMessage(error));
    }
  };

  const selectedTilePinned = selectedId ? pinnedTileIds.has(selectedId) : false;

  return (
    <div className="w-full h-screen flex flex-col">
      <div className="relative noise-bg bg-cloud overflow-hidden flex flex-col flex-1">
        <BackgroundLayer config={settingsConfig} />
        <MainTitleBar
          displayTitle={
            title ||
            selectedNote?.preview ||
            t("common.untitledNote", { defaultValue: "无标题笔记" })
          }
          hasPendingUpdate={aboutUpdateReminder.hasPendingUpdate}
          showUpdateText={aboutUpdateReminder.showText}
          onOpenNotepad={() => void handleOpenNotepad()}
          onOpenSettings={() => void handleOpenSettings()}
          onOpenAbout={handleOpenAbout}
        />

        <div className="relative z-10 flex flex-1 min-h-0">
          <NoteSidebar
            width={sidebarWidth}
            collapsed={sidebarCollapsed}
            animated={sidebarAnimated}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            noteCount={filteredNotes.length}
            externalFiles={externalFiles}
            categoryGroups={categoryGroups}
            collapsedCategories={collapsedCategories}
            isLoading={isLoading}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHoverChange={setHoveredId}
            onNewNote={handleNewNote}
            onImportNote={() => void handleImportNote()}
            onSelectNote={(id) => void handleSelectNote(id)}
            onSelectExternalFile={(id) => void handleSelectExternalFile(id)}
            onRemoveExternalFile={handleRemoveExternalFile}
            onOpenNoteMenu={handleOpenNoteMenu}
            onMoveNote={(noteId, category) => void handleMoveNote(noteId, category)}
            onToggleCategoryCollapse={toggleCategoryCollapse}
            onOpenCategoryMenu={handleOpenCategoryMenu}
            onCreateCategory={handleCreateCategory}
            renamingCategory={renamingCategory}
            renameCategoryValue={renameCategoryValue}
            onRenameCategoryValueChange={setRenameCategoryValue}
            onRenameCategoryCommit={(name) => void handleRenameCategory(name)}
            onRenameCategoryCancel={() => setRenamingCategory(null)}
          />

          {!sidebarCollapsed && (
            <div
              className={`w-1 shrink-0 cursor-col-resize group relative ${isResizingSidebar ? "bg-bamboo/30" : "hover:bg-bamboo/20"} transition-colors`}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingSidebar(true);
              }}
            >
              <div
                className={`absolute inset-y-0 -left-1 -right-1 ${isResizingSidebar ? "" : "group-hover:bg-bamboo/5"}`}
              />
            </div>
          )}

          <div className="flex-1 flex flex-col min-w-0">
            <EditorToolbar
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
              hasNote={Boolean(selectedId)}
              tilePinned={selectedTilePinned}
              onTogglePin={() => void handlePinEntry()}
              onUndo={handleUndo}
              onRedo={handleRedo}
              saveDisabled={!selectedId || saveState === "saving"}
              onSave={() => void saveCurrentNote(true)}
              deleteConfirm={deleteConfirm}
              onDeleteConfirmChange={setDeleteConfirm}
              onDelete={() => void handleDeleteNote()}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />

            <NoteHeader
              transitionKey={noteTransitionKey}
              title={title}
              onTitleChange={(value) => {
                setTitle(value);
                markDirty();
              }}
              onSubmit={() => contentRef.current?.focus()}
              disabled={!selectedId}
              metaText={
                selectedExternalFile
                  ? t("main.externalFile.label", {
                      path: selectedExternalFile.filePath,
                      defaultValue: "外部文件 · {{path}}",
                    })
                  : selectedNote
                    ? `${formatShortDate(selectedNote.updatedAt)} ${formatTime(selectedNote.updatedAt)}`
                    : "--"
              }
              charCount={charCount}
              saveState={saveState}
            />

            <div
              key={viewMode}
              ref={splitContainerRef}
              className="flex-1 flex min-h-0 animate-view-fade"
            >
              {!selectedId && !isLoading ? (
                <div className="flex-1 flex items-center justify-center text-[13px] text-ink-ghost">
                  {t("main.editor.emptyHint", { defaultValue: "选择或新建一篇笔记" })}
                </div>
              ) : (
                <>
                  {(viewMode === "edit" || viewMode === "split") && (
                    <div
                      className="flex flex-col min-h-0 shrink-0"
                      style={{ width: viewMode === "split" ? `${splitRatio * 100}%` : "100%" }}
                    >
                      <FormatToolbar
                        onFormat={(action) => {
                          if (contentRef.current) {
                            applyFormat(contentRef.current, action, t, setContent, markDirty);
                          }
                        }}
                        onInsertImage={() => void handleInsertLocalImage()}
                      />

                      <div className="flex-1 overflow-hidden px-5 pb-4">
                        <textarea
                          ref={contentRef}
                          data-tab-indent="true"
                          value={content}
                          onChange={(event) => {
                            setContent(event.target.value);
                            markDirty();
                          }}
                          onPaste={imagePasteHandler}
                          onDrop={imageDropHandler}
                          onDragOver={imageDragOverHandler}
                          onScroll={handleEditorScroll}
                          className="w-full h-full leading-[1.9] text-ink-soft font-body placeholder:text-ink-ghost/40"
                          style={{
                            fontSize: `${settingsConfig?.fontSize ?? 14}px`,
                            tabSize: `var(--tab-indent-size, 2)`,
                          }}
                          placeholder={t("main.editor.contentPlaceholder", {
                            defaultValue: "开始写作……",
                          })}
                          spellCheck={false}
                          disabled={!selectedId}
                        />
                      </div>
                    </div>
                  )}

                  {viewMode === "split" && (
                    <div
                      className={`w-1.5 shrink-0 cursor-col-resize group relative flex items-center justify-center ${isResizingSplit ? "bg-bamboo/30" : "hover:bg-bamboo/20"} transition-colors`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizingSplit(true);
                      }}
                    >
                      <div
                        className={`absolute inset-y-0 -left-1.5 -right-1.5 ${isResizingSplit ? "" : "group-hover:bg-bamboo/5"}`}
                      />
                      {/* 拖拽手柄指示器 */}
                      <div className="relative z-10 flex flex-col gap-[3px] opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-[3px] h-[3px] rounded-full bg-ink-ghost/60" />
                        <div className="w-[3px] h-[3px] rounded-full bg-ink-ghost/60" />
                        <div className="w-[3px] h-[3px] rounded-full bg-ink-ghost/60" />
                      </div>
                    </div>
                  )}

                  {(viewMode === "preview" || viewMode === "split") && (
                    <div className="flex flex-col min-h-0 min-w-0 flex-1">
                      {viewMode === "split" && (
                        <div className="px-4 pt-2.5 pb-1 shrink-0">
                          <span className="text-[10px] text-ink-ghost/60 font-mono tracking-widest uppercase">
                            {t("main.editor.previewLabel", { defaultValue: "Preview" })}
                          </span>
                        </div>
                      )}
                      <div
                        ref={previewScrollRef}
                        onScroll={handlePreviewScroll}
                        className={`flex-1 overflow-y-auto px-6 pb-6 ${
                          viewMode === "preview" ? "pt-3" : "pt-1"
                        }`}
                      >
                        <MarkdownPreview
                          content={deferredContent}
                          fontSize={settingsConfig?.fontSize ?? 14}
                          renderHtml={settingsConfig?.renderHtmlMarkdown ?? false}
                          imageBaseDir={imageBaseDir ?? undefined}
                          externalFileDir={externalFileDir}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <EditorStatusBar
              lineCount={lineCount}
              byteSize={byteSize}
              showCleanImages={Boolean(selectedId) && !isExternal && content.includes("images/")}
              onCleanImages={() => void handleCleanUnusedImages()}
            />
          </div>
          {settingsConfig && settingsOpen && settingsOverlay && (
            <div className="absolute inset-0 z-20" onClick={handleCloseSettings} />
          )}
          <div
            className={`relative shrink-0 overflow-hidden h-full transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              sidePanelExpanded || mountedSidePanel ? "border-l border-paper-deep/20" : "border-l-0"
            } ${
              settingsOverlay
                ? `absolute right-0 top-0 bottom-0 z-30 ${visibleSidePanel ? "w-[360px] shadow-xl" : "w-0"}`
                : `${sidePanelExpanded ? "w-[360px]" : "w-0"}`
            }`}
          >
            <div
              className={`absolute inset-0 w-[360px] h-full transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mountedSidePanel === "about"
                  ? sidePanelContentVisible && visibleSidePanel === "about"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none translate-x-4 opacity-0"
                  : "pointer-events-none translate-x-4 opacity-0"
              }`}
            >
              {mountedSidePanel === "about" ? (
                <Suspense fallback={null}>
                  <AboutPanel onClose={handleCloseAbout} />
                </Suspense>
              ) : null}
            </div>
            <div
              className={`absolute inset-0 w-[360px] h-full transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                mountedSidePanel === "settings"
                  ? sidePanelContentVisible && visibleSidePanel === "settings"
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none translate-x-4 opacity-0"
                  : "pointer-events-none translate-x-4 opacity-0"
              }`}
            >
              {mountedSidePanel === "settings" && settingsConfig ? (
                <Suspense fallback={null}>
                  <SettingsPanel
                    config={settingsConfig}
                    onChange={handleSettingsChange}
                    onMigrateDataDir={() => void handleMigrateDataDir()}
                    onClose={handleCloseSettings}
                  />
                </Suspense>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {noteMenu && noteMenuTarget && (
        <NoteContextMenu
          anchor={noteMenu}
          closing={noteMenuClosing}
          mode={noteMenuMode}
          items={noteContextMenuItems}
          categories={categories}
          onAction={handleNoteMenuAction}
          onBack={() => setNoteMenuMode("main")}
          onMoveTo={(category) => void handleMoveNote(noteMenuTarget.id, category)}
        />
      )}

      {categoryMenu && (
        <CategoryContextMenu
          anchor={categoryMenu}
          category={categoryMenu.category}
          closing={categoryMenuClosing}
          confirmDelete={categoryMenuConfirmDelete}
          hoverSuppressed={categoryMenuHoverSuppressed}
          onRename={() => {
            setCategoryMenuClosing(true);
            setRenamingCategory(categoryMenu.category);
            setRenameCategoryValue(categoryMenu.category);
          }}
          onDelete={() => {
            void handleDeleteCategory(categoryMenu.category);
            setCategoryMenuClosing(true);
          }}
          onSwitchPanel={switchCategoryMenuPanel}
        />
      )}
    </div>
  );
}
