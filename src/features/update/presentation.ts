import type { TFunction } from "i18next";
import { getUpdateErrorMessage } from "./updateErrors";
import type { UpdateState } from "./types";

export const ABOUT_UPDATE_LABEL_DURATION_MS = 30_000;

// 无法应用内更新时引导用户手动下载的 Release 页面
export const MANUAL_DOWNLOAD_URL =
  "https://github.com/chengzhirenchaoshuai/floral-notepaper/releases/latest";

// 这些错误表示只能手动下载新版替换
const MANUAL_DOWNLOAD_ERROR_CODES = new Set([
  "updatePortableDirNotWritable",
  "updatePortableManualOnly",
]);

/** 便携版已发现新版本、但无法在应用内完成更新时，提供“打开下载页”入口。 */
export function shouldOfferManualDownload(
  status: Pick<UpdateState, "installKind" | "latestVersion" | "lastError"> | null | undefined,
): boolean {
  return (
    status?.installKind === "windowsPortable" &&
    Boolean(status.latestVersion) &&
    MANUAL_DOWNLOAD_ERROR_CODES.has(status.lastError?.code ?? "")
  );
}

export type UpdateNoticeTone = "idle" | "success" | "error";

export interface UpdateInlineNotice {
  tone: UpdateNoticeTone;
  text: string;
}

export interface AboutUpdateReminderState {
  hasPendingUpdate: boolean;
  showText: boolean;
}

export function hasPendingUpdate(
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): boolean {
  return Boolean(status?.latestVersion);
}

export function createAboutUpdateReminderState(
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): AboutUpdateReminderState {
  return {
    hasPendingUpdate: hasPendingUpdate(status),
    showText: false,
  };
}

export function applyAboutUpdateStatus(
  current: AboutUpdateReminderState,
  status: Pick<UpdateState, "latestVersion"> | null | undefined,
): AboutUpdateReminderState {
  if (!hasPendingUpdate(status)) {
    return { hasPendingUpdate: false, showText: false };
  }

  if (!current.hasPendingUpdate) {
    return { hasPendingUpdate: true, showText: true };
  }

  return {
    hasPendingUpdate: true,
    showText: current.showText,
  };
}

export function dismissAboutUpdateReminderText(
  current: AboutUpdateReminderState,
): AboutUpdateReminderState {
  return {
    hasPendingUpdate: current.hasPendingUpdate,
    showText: false,
  };
}

export function getUpdateCheckCompletionNotice(
  status: UpdateState,
  translate: TFunction,
): UpdateInlineNotice | null {
  if (status.status === "available") {
    return {
      tone: "success",
      text: translate("settings.update.available", {
        version: status.latestVersion,
        defaultValue: "发现新版本 {{version}}",
      }),
    };
  }

  if (status.status === "idle" && status.checkedAt) {
    return {
      tone: "success",
      text: translate("settings.update.notAvailable", {
        defaultValue: "当前已是最新版本",
      }),
    };
  }

  if (status.status === "failed" && status.lastError) {
    return {
      tone: "error",
      text: getUpdateErrorMessage(status.lastError, translate),
    };
  }

  return null;
}

export function getInitialUpdateStatusNotice(
  status: UpdateState | null | undefined,
  translate: TFunction,
): UpdateInlineNotice | null {
  if (status?.status === "failed" && status.lastError) {
    return {
      tone: "error",
      text: getUpdateErrorMessage(status.lastError, translate),
    };
  }

  return null;
}

export function getUpdateStatusHydrationNotice(
  notice: UpdateInlineNotice | null,
  translate: TFunction,
): UpdateInlineNotice {
  if (notice?.tone === "error") {
    return notice;
  }

  return {
    tone: "idle",
    text: translate("settings.update.loading", {
      defaultValue: "正在读取更新设置...",
    }),
  };
}
