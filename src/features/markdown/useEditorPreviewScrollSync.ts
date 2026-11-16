import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { ViewMode } from "../settings/types";
import {
  createScrollSyncMap,
  interpolateScrollOffset,
  measureBlockOffsets,
  measurePreviewBlockOffsets,
  tagPreviewBlocks,
  type ScrollSyncMap,
} from "./scrollSync";

interface ScrollSyncOptions {
  contentRef: RefObject<HTMLTextAreaElement | null>;
  splitContainerRef: RefObject<HTMLDivElement | null>;
  viewMode: ViewMode;
  // 设置中的“分栏滚动同步”开关
  enabled: boolean;
  content: string;
  selectedId: string | null;
  // 以下值变化会影响排版，需要重新测量
  fontSize: number | undefined;
  renderHtmlMarkdown: boolean | undefined;
  preserveLineBreaks: boolean | undefined;
  splitRatio: number;
}

// 分栏模式下编辑器与预览的双向滚动同步
export function useEditorPreviewScrollSync({
  contentRef,
  splitContainerRef,
  viewMode,
  enabled,
  content,
  selectedId,
  fontSize,
  renderHtmlMarkdown,
  preserveLineBreaks,
  splitRatio,
}: ScrollSyncOptions) {
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const scrollMaps = useRef<{
    editorToPreview: ScrollSyncMap;
    previewToEditor: ScrollSyncMap;
  } | null>(null);
  const scrollSource = useRef<"editor" | "preview" | null>(null);
  const scrollSyncRafRef = useRef<number>(0);
  const scrollReleaseRafRef = useRef<number>(0);
  const measureDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureRafRef = useRef<number>(0);
  const measureControllerRef = useRef<AbortController | null>(null);
  const prevSelectedIdRef = useRef(selectedId);

  const cancelScrollMeasurement = useCallback(() => {
    if (measureDebounceRef.current) clearTimeout(measureDebounceRef.current);
    cancelAnimationFrame(measureRafRef.current);
    measureControllerRef.current?.abort();
  }, []);

  const cancelScheduledScrollSync = useCallback(() => {
    cancelAnimationFrame(scrollSyncRafRef.current);
    cancelAnimationFrame(scrollReleaseRafRef.current);
    scrollSyncRafRef.current = 0;
    scrollReleaseRafRef.current = 0;
    scrollSource.current = null;
  }, []);

  const scheduleScrollMeasurement = useCallback(
    (delayMs: number) => {
      if (viewMode !== "split" || !enabled) return;
      if (!contentRef.current || !previewScrollRef.current) return;

      // 布局和测量稳定前先清空旧偏移量
      scrollMaps.current = null;
      cancelScrollMeasurement();

      const controller = new AbortController();
      measureControllerRef.current = controller;

      const measure = async () => {
        const textarea = contentRef.current;
        const preview = previewScrollRef.current;
        if (!textarea || !preview) return;

        const editorOffsets = await measureBlockOffsets(content, textarea, controller.signal);
        if (controller.signal.aborted) return;

        tagPreviewBlocks(preview);
        const previewOffsets = measurePreviewBlockOffsets(preview);
        const editorMaxScroll = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
        const previewMaxScroll = Math.max(0, preview.scrollHeight - preview.clientHeight);
        scrollMaps.current = {
          editorToPreview: createScrollSyncMap(
            editorOffsets,
            previewOffsets,
            editorMaxScroll,
            previewMaxScroll,
          ),
          previewToEditor: createScrollSyncMap(
            previewOffsets,
            editorOffsets,
            previewMaxScroll,
            editorMaxScroll,
          ),
        };
      };

      const runAfterLayout = () => {
        measureRafRef.current = requestAnimationFrame(() => {
          void measure();
        });
      };

      if (delayMs > 0) {
        measureDebounceRef.current = setTimeout(runAfterLayout, delayMs);
      } else {
        runAfterLayout();
      }
    },
    [cancelScrollMeasurement, content, enabled, viewMode],
  );

  // 切换笔记时通过 rAF 测量（不阻塞首帧渲染），编辑时 debounce 避免频繁重排
  useEffect(() => {
    if (viewMode !== "split" || !enabled) {
      scrollMaps.current = null;
      cancelScrollMeasurement();
      cancelScheduledScrollSync();
      return;
    }

    const isNoteSwitch = prevSelectedIdRef.current !== selectedId;
    prevSelectedIdRef.current = selectedId;
    scheduleScrollMeasurement(isNoteSwitch ? 0 : 250);

    return () => {
      cancelScrollMeasurement();
    };
  }, [
    cancelScrollMeasurement,
    cancelScheduledScrollSync,
    content,
    enabled,
    scheduleScrollMeasurement,
    selectedId,
    fontSize,
    renderHtmlMarkdown,
    preserveLineBreaks,
    splitRatio,
    viewMode,
  ]);

  useEffect(() => {
    if (viewMode !== "split") return;

    const observedElements: Element[] = [];
    if (splitContainerRef.current) observedElements.push(splitContainerRef.current);
    if (contentRef.current) observedElements.push(contentRef.current);
    if (previewScrollRef.current) observedElements.push(previewScrollRef.current);
    const previewContent = previewScrollRef.current?.querySelector<HTMLElement>(".font-body");
    if (previewContent) observedElements.push(previewContent);

    if (typeof ResizeObserver === "undefined") {
      const handleResize = () => scheduleScrollMeasurement(120);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    if (observedElements.length === 0) return;

    const observer = new ResizeObserver(() => {
      scheduleScrollMeasurement(120);
    });
    observedElements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [scheduleScrollMeasurement, viewMode]);

  // Reset preview scroll on note switch
  useEffect(() => {
    if (previewScrollRef.current) {
      previewScrollRef.current.scrollTop = 0;
    }
  }, [selectedId]);

  const releaseScrollSourceAfterPaint = useCallback((source: "editor" | "preview") => {
    cancelAnimationFrame(scrollReleaseRafRef.current);
    scrollReleaseRafRef.current = requestAnimationFrame(() => {
      scrollReleaseRafRef.current = requestAnimationFrame(() => {
        if (scrollSource.current === source) scrollSource.current = null;
        scrollReleaseRafRef.current = 0;
      });
    });
  }, []);

  const scheduleSyncedScroll = useCallback(
    (source: "editor" | "preview") => {
      if (scrollSyncRafRef.current) return;
      scrollSyncRafRef.current = requestAnimationFrame(() => {
        scrollSyncRafRef.current = 0;
        const textarea = contentRef.current;
        const preview = previewScrollRef.current;
        const maps = scrollMaps.current;
        if (!textarea || !preview || !maps || scrollSource.current !== source) return;

        if (source === "editor") {
          preview.scrollTop = interpolateScrollOffset(maps.editorToPreview, textarea.scrollTop);
        } else {
          textarea.scrollTop = interpolateScrollOffset(maps.previewToEditor, preview.scrollTop);
        }
        releaseScrollSourceAfterPaint(source);
      });
    },
    [releaseScrollSourceAfterPaint],
  );

  const handleEditorScroll = useCallback(() => {
    if (viewMode !== "split" || !enabled || !scrollMaps.current) return;
    if (scrollSource.current === "preview") return;

    scrollSource.current = "editor";
    cancelAnimationFrame(scrollReleaseRafRef.current);
    scrollReleaseRafRef.current = 0;
    scheduleSyncedScroll("editor");
  }, [scheduleSyncedScroll, enabled, viewMode]);

  const handlePreviewScroll = useCallback(() => {
    if (viewMode !== "split" || !enabled || !scrollMaps.current) return;
    if (scrollSource.current === "editor") return;

    scrollSource.current = "preview";
    cancelAnimationFrame(scrollReleaseRafRef.current);
    scrollReleaseRafRef.current = 0;
    scheduleSyncedScroll("preview");
  }, [scheduleSyncedScroll, enabled, viewMode]);

  useEffect(() => cancelScheduledScrollSync, [cancelScheduledScrollSync]);

  return { previewScrollRef, handleEditorScroll, handlePreviewScroll };
}
