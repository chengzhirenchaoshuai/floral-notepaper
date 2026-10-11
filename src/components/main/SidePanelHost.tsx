import { Suspense, lazy, useEffect, useState } from "react";
import type { AppConfig } from "../../features/settings/types";

export type SidePanelMode = "about" | "settings";

// 侧面板只在用户主动打开时挂载，懒加载可把关于面板（贡献者数据、更新设置）
// 和设置面板从首屏 bundle 中拆出
const AboutPanel = lazy(() =>
  import("../AboutPanel").then((module) => ({ default: module.AboutPanel })),
);
const SettingsPanel = lazy(() =>
  import("../SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);

// 退出动画结束后再卸载面板，需与宽度过渡时长匹配
const PANEL_UNMOUNT_DELAY_MS = 320;
// 窗口窄于此宽度时侧面板以浮层形式覆盖在编辑区上方
const OVERLAY_BREAKPOINT = 1080;

interface SidePanelHostProps {
  // 当前应显示的面板，null 表示收起
  visiblePanel: SidePanelMode | null;
  // 首次渲染即需显示的面板（设置窗口直接打开时）
  initialPanel: SidePanelMode | null;
  // 设置面板处于打开请求中（用于窄窗口下显示点击关闭的遮罩）
  settingsRequested: boolean;
  settingsConfig: AppConfig | null;
  onCloseAbout: () => void;
  onCloseSettings: () => void;
  onSettingsChange: (config: AppConfig) => void;
  onMigrateDataDir: () => void;
}

// 主窗口右侧的“关于 / 设置”面板容器：负责展开收起动画与懒加载
export function SidePanelHost({
  visiblePanel,
  initialPanel,
  settingsRequested,
  settingsConfig,
  onCloseAbout,
  onCloseSettings,
  onSettingsChange,
  onMigrateDataDir,
}: SidePanelHostProps) {
  const [mountedPanel, setMountedPanel] = useState<SidePanelMode | null>(initialPanel);
  const [contentVisible, setContentVisible] = useState(initialPanel !== null);
  const [overlay, setOverlay] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < OVERLAY_BREAKPOINT : true,
  );
  const expanded = visiblePanel !== null;

  useEffect(() => {
    const onResize = () => setOverlay(window.innerWidth < OVERLAY_BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (visiblePanel) {
      setMountedPanel(visiblePanel);
      setContentVisible(false);

      const frame = window.requestAnimationFrame(() => {
        setContentVisible(true);
      });

      return () => window.cancelAnimationFrame(frame);
    }

    setContentVisible(false);
    if (!mountedPanel) return;

    const timer = window.setTimeout(() => {
      setMountedPanel((current) => (current === mountedPanel ? null : current));
    }, PANEL_UNMOUNT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [mountedPanel, visiblePanel]);

  const panelClass = (mode: SidePanelMode) =>
    `absolute inset-0 w-[360px] h-full transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
      mountedPanel === mode && contentVisible && visiblePanel === mode
        ? "translate-x-0 opacity-100"
        : "pointer-events-none translate-x-4 opacity-0"
    }`;

  return (
    <>
      {settingsRequested && overlay && (
        <div className="absolute inset-0 z-20" onClick={onCloseSettings} />
      )}
      <div
        className={`relative shrink-0 overflow-hidden h-full transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded || mountedPanel ? "border-l border-paper-deep/20" : "border-l-0"
        } ${
          overlay
            ? `absolute right-0 top-0 bottom-0 z-30 ${visiblePanel ? "w-[360px] shadow-xl" : "w-0"}`
            : `${expanded ? "w-[360px]" : "w-0"}`
        }`}
      >
        <div className={panelClass("about")}>
          {mountedPanel === "about" ? (
            <Suspense fallback={null}>
              <AboutPanel onClose={onCloseAbout} />
            </Suspense>
          ) : null}
        </div>
        <div className={panelClass("settings")}>
          {mountedPanel === "settings" && settingsConfig ? (
            <Suspense fallback={null}>
              <SettingsPanel
                config={settingsConfig}
                onChange={onSettingsChange}
                onMigrateDataDir={onMigrateDataDir}
                onClose={onCloseSettings}
              />
            </Suspense>
          ) : null}
        </div>
      </div>
    </>
  );
}
