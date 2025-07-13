import { useCallback } from "react";
import type { ChromeMessageResponse, ChromeMessageData } from "../types";

export const useChromeAPI = () => {
  const sendMessage = useCallback(async (action: string, data?: ChromeMessageData): Promise<ChromeMessageResponse> => {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (tabId === undefined) {
          reject(new Error("无法连接到页面。请刷新页面后重试。"));
          return;
        }

        chrome.tabs.sendMessage(tabId, { action, ...data }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response || {});
        });
      });
    });
  }, []);

  return { sendMessage };
}; 