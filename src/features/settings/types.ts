export type ViewMode = "edit" | "split" | "preview";

export type ThemeOption = "light" | "dark" | "system";

export type TileColorMode = "system" | "custom";
export type BackgroundFit = "cover" | "contain" | "repeat";

export interface AppConfig {
  dataDir: string;
  globalShortcut: string;
  closeToTray: boolean;
  autostart: boolean;
  defaultViewMode: string;
  noteAutoSave: boolean;
  noteSurfaceAutoSave: boolean;
  tileColor: string;
  tileColorMode: TileColorMode;
  theme: ThemeOption;
  fontSize: number;
  interfaceFontFamily: string;
  backgroundColor: string;
  surfaceFontSize: number;
  tabIndentSize: number;
  externalFileAutoSave: boolean;
  rememberSurfaceSize: boolean;
  notepadAlwaysOnTop: boolean;
  rememberWindowBounds: boolean;
  tileCtrlClose: boolean;
  tileDoubleClickToEdit: boolean;
  tileSaveReturnsToPin: boolean;
  tileRenderMarkdown: boolean;
  splitScrollSync: boolean;
  preserveLineBreaks: boolean;
  surfaceWidth?: number;
  surfaceHeight?: number;
  windowX?: number;
  windowY?: number;
  windowWidth?: number;
  windowHeight?: number;
  toggleVisibilityShortcut: string;
  openAtCursor: boolean;
  collapseSidebarOnStartup: boolean;
  // 隐藏模式：不显示托盘图标，关闭主窗口后进程常驻后台
  hideTrayIcon: boolean;
  backgroundImagePath?: string;
  backgroundFit?: BackgroundFit;
  backgroundDim?: number;
  backgroundBlur?: number;
  backgroundScale?: number;
  backgroundPositionX?: number;
  backgroundPositionY?: number;
}
