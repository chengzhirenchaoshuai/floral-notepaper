import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getUpdateStatus } from "./api";
import {
  ABOUT_UPDATE_LABEL_DURATION_MS,
  applyAboutUpdateStatus,
  createAboutUpdateReminderState,
  dismissAboutUpdateReminderText,
  type AboutUpdateReminderState,
} from "./presentation";
import type { UpdateErrorPayload, UpdateState } from "./types";

// 主窗口“关于”按钮上的新版本提醒：拉取更新状态、监听更新事件，提示文字定时收起
export function useAboutUpdateReminder() {
  const [aboutUpdateReminder, setAboutUpdateReminder] = useState<AboutUpdateReminderState>(() =>
    createAboutUpdateReminderState(null),
  );
  const updateStatusHydratedRef = useRef(false);
  const syncUpdateStatus = useCallback((nextStatus: UpdateState) => {
    const shouldHydrate = !updateStatusHydratedRef.current;
    if (shouldHydrate) {
      updateStatusHydratedRef.current = true;
    }

    setAboutUpdateReminder((current) =>
      shouldHydrate
        ? createAboutUpdateReminderState(nextStatus)
        : applyAboutUpdateStatus(current, nextStatus),
    );
  }, []);

  useEffect(() => {
    let active = true;

    void getUpdateStatus()
      .then((status) => {
        if (!active) return;
        syncUpdateStatus(status);
      })
      .catch((error) => {
        console.error("failed to load update status", error);
      });

    const bindEvents = async () => {
      const unlistenFns: UnlistenFn[] = [];
      const disposeAll = () => {
        for (const unlisten of unlistenFns.splice(0)) {
          unlisten();
        }
      };

      try {
        unlistenFns.push(
          await listen<UpdateState>("update://checking", (event) => {
            if (!active) return;
            syncUpdateStatus(event.payload);
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://checked", (event) => {
            if (!active) return;
            syncUpdateStatus(event.payload);
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://download-finished", (event) => {
            if (!active) return;
            syncUpdateStatus(event.payload);
          }),
        );

        unlistenFns.push(
          await listen<UpdateState>("update://install-finished", (event) => {
            if (!active) return;
            syncUpdateStatus(event.payload);
          }),
        );

        unlistenFns.push(
          await listen("update://error", () => {
            if (!active) return;
            void getUpdateStatus()
              .then((status) => {
                if (!active) return;
                syncUpdateStatus(status);
              })
              .catch((error) => {
                console.error("failed to refresh update status after error event", error);
              });
          }),
        );

        unlistenFns.push(
          await listen<UpdateErrorPayload>("update://auto-check-error", (event) => {
            if (!active) return;
            console.error("automatic update check failed", event.payload);
            void getUpdateStatus()
              .then((status) => {
                if (!active) return;
                syncUpdateStatus(status);
              })
              .catch((error) => {
                console.error("failed to refresh update status after automatic check error", error);
              });
          }),
        );

        return disposeAll;
      } catch (error) {
        disposeAll();
        console.error("failed to bind update event listeners", error);
        return () => undefined;
      }
    };

    const promise = bindEvents();

    return () => {
      active = false;
      void promise
        .then((dispose) => dispose())
        .catch((error) => {
          console.error("failed to dispose update event listeners", error);
        });
    };
  }, [syncUpdateStatus]);

  useEffect(() => {
    if (!aboutUpdateReminder.showText) return;
    const timer = window.setTimeout(() => {
      setAboutUpdateReminder((current) => dismissAboutUpdateReminderText(current));
    }, ABOUT_UPDATE_LABEL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [aboutUpdateReminder.showText]);

  const dismissReminderText = useCallback(() => {
    setAboutUpdateReminder((current) => dismissAboutUpdateReminderText(current));
  }, []);

  return { aboutUpdateReminder, dismissReminderText };
}
