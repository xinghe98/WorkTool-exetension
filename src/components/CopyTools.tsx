import { useState, useCallback } from "react";
import { formatError } from "../utils";
import type { CopyToolsProps } from "../types";

export function CopyTools({ sendMessage, isLoading, setIsLoading, setMessage }: CopyToolsProps) {
  const [copyEnabled, setCopyEnabled] = useState<boolean>(false);

  const toggleCopyProtection = useCallback(async () => {
    try {
      setIsLoading(true);
      setMessage("正在切换复制保护...");

      const response = await sendMessage("toggleCopyProtection");
      
      if (response.error) {
        setMessage(`操作失败: ${response.error}`);
      } else {
        setCopyEnabled(response.copyEnabled || false);
        setMessage(
          response.copyEnabled 
            ? "已启用复制功能！" 
            : "已禁用复制功能。"
        );
      }
    } catch (error) {
      const errorMessage = formatError(error);
      setMessage(`操作失败: ${errorMessage}`);
      console.error("切换复制保护时出错:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage, setIsLoading, setMessage]);

  const checkCopyStatus = useCallback(async () => {
    try {
      const response = await sendMessage("checkCopyStatus");
      setCopyEnabled(response.copyEnabled || false);
    } catch (error) {
      console.error("检查复制状态时出错:", error);
    }
  }, [sendMessage]);

  // 组件挂载时检查复制状态
  useState(() => {
    checkCopyStatus();
  });

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">复制保护解除</h3>
        <div className="flex items-center gap-3 mb-4 p-3 bg-white/10 rounded-lg backdrop-blur-md">
          <span className={`w-3 h-3 rounded-full transition-all duration-300 ${copyEnabled ? 'bg-gradient-to-r from-green-400 to-teal-400 shadow-[0_0_10px_#2ecc71]' : 'bg-gradient-to-r from-red-500 to-yellow-500 shadow-[0_0_10px_#e74c3c]'}`}></span>
          <span className="text-sm font-medium">{copyEnabled ? "复制功能已启用" : "复制功能已禁用"}</span>
        </div>
        <button
          onClick={toggleCopyProtection}
          disabled={isLoading}
          className={`w-full py-3.5 px-5 text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg relative overflow-hidden ${copyEnabled ? 'bg-gradient-to-r from-red-500 to-orange-600 hover:scale-105' : 'bg-gradient-to-r from-green-500 to-teal-600 hover:scale-105'}`}
        >
          {isLoading ? "⏳ 处理中..." : copyEnabled ? "🚫 禁用复制" : "✅ 启用复制"}
        </button>
        <p className="mt-3 text-xs opacity-80 p-3 bg-white/5 rounded-lg border-l-2 border-white/30">
          点击按钮可以切换页面的复制保护状态，让您可以自由复制页面内容。
        </p>
      </div>
    </div>
  );
} 