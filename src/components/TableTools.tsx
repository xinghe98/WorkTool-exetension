import { useState, useCallback } from "react";
import { formatError } from "../utils";
import type { TableInfo, TableToolsProps } from "../types";

export function TableTools({
  sendMessage,
  isLoading,
  setIsLoading,
  setMessage,
}: TableToolsProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<number>>(new Set());

  const findTables = useCallback(async () => {
    try {
      setIsLoading(true);
      setTables([]);
      setSelectedTables(new Set());
      setMessage("正在连接到页面...");

      // 首先检查连接
      await sendMessage("ping");
      setMessage("连接成功，正在查找表格...");

      // 查找表格
      const response = await sendMessage("findTables");
      if (response.tables) {
        setTables(response.tables);
        setMessage(
          response.tables.length > 0
            ? `找到了 ${response.tables.length} 个表格!`
            : "当前页面未找到表格。",
        );
      }
    } catch (error) {
      const errorMessage = formatError(error);
      setMessage(`操作失败: ${errorMessage} 请刷新页面后重试。`);
      console.error("查找表格时出错:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sendMessage, setIsLoading, setMessage]);

  const highlightTable = useCallback(
    async (tableId: number) => {
      try {
        await sendMessage("highlightTable", { tableId });
      } catch (error) {
        console.error("高亮表格时出错:", error);
      }
    },
    [sendMessage],
  );

  const copySingleTable = useCallback(
    async (tableId: number) => {
      try {
        setIsLoading(true);
        setMessage(`正在复制表格 ${tableId + 1}...`);

        const response = await sendMessage("copySingleTable", { tableId });

        if (response.error) {
          setMessage(`复制失败: ${response.error}`);
        } else {
          setMessage(
            response.success
              ? `表格 ${tableId + 1} 已复制到剪贴板！`
              : "复制失败。",
          );
        }
      } catch (error) {
        const errorMessage = formatError(error);
        setMessage(`复制失败: ${errorMessage}`);
        console.error("复制单个表格时出错:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [sendMessage, setIsLoading, setMessage],
  );

  const copySelectedTables = useCallback(async () => {
    if (selectedTables.size === 0) {
      setMessage("请先选择要复制的表格");
      return;
    }

    try {
      setIsLoading(true);
      setMessage(`正在复制选中的 ${selectedTables.size} 个表格...`);

      const response = await sendMessage("copySelectedTables", {
        selectedIds: Array.from(selectedTables),
      });

      if (response.error) {
        setMessage(`复制失败: ${response.error}`);
      } else {
        setMessage(
          response.success
            ? `已复制 ${selectedTables.size} 个表格到剪贴板！`
            : "复制失败。",
        );
      }
    } catch (error) {
      const errorMessage = formatError(error);
      setMessage(`复制失败: ${errorMessage}`);
      console.error("复制选中表格时出错:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTables, sendMessage, setIsLoading, setMessage]);

  const copyTables = useCallback(async () => {
    if (tables.length === 0) {
      setMessage("没有可复制的表格");
      return;
    }

    try {
      setIsLoading(true);
      setMessage("正在复制表格...");

      const response = await sendMessage("copyTables");

      if (response.error) {
        setMessage(`复制失败: ${response.error}`);
      } else {
        setMessage(response.success ? "表格已复制到剪贴板！" : "复制失败。");
      }
    } catch (error) {
      const errorMessage = formatError(error);
      setMessage(`复制失败: ${errorMessage}`);
      console.error("复制表格时出错:", error);
    } finally {
      setIsLoading(false);
    }
  }, [tables.length, sendMessage, setIsLoading, setMessage]);

  const toggleTableSelection = useCallback((tableId: number) => {
    setSelectedTables((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(tableId)) {
        newSet.delete(tableId);
      } else {
        newSet.add(tableId);
      }
      return newSet;
    });
  }, []);

  const selectAllTables = useCallback(() => {
    setSelectedTables(new Set(tables.map((_, index) => index)));
  }, [tables]);

  const clearSelection = useCallback(() => {
    setSelectedTables(new Set());
  }, []);

  // 格式化表格预览内容
  const formatTablePreview = (preview: string) => {
    if (!preview) return "无预览内容";

    // 限制预览长度，避免过长
    const maxLength = 100;
    if (preview.length > maxLength) {
      return preview.substring(0, maxLength) + "...";
    }
    return preview;
  };

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          表格检测
        </h3>
        <button
          onClick={findTables}
          disabled={isLoading}
          className="w-full py-3.5 px-5 text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg relative overflow-hidden bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? "🔍 检测中..." : "🔍 查找页面表格"}
        </button>
      </div>

      {tables.length > 0 && (
        <div className="animate-fadeIn">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              表格列表 ({tables.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAllTables}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 hover:bg-blue-500/30 transition-all"
              >
                📋 全选
              </button>
              <button
                onClick={clearSelection}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-gray-500/20 hover:bg-gray-500/30 transition-all"
              >
                🚫 清空
              </button>
              <button
                onClick={copyTables}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-semibold rounded-md bg-gradient-to-r from-green-500 to-teal-600 hover:scale-105 transition-all disabled:opacity-60"
              >
                📋 复制所有
              </button>
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-2 space-y-2">
            {tables.map((table) => (
              <div
                key={table.id}
                className={`p-4 rounded-lg backdrop-blur-md border transition-all duration-300 hover:translate-x-1 ${
                  selectedTables.has(table.id)
                    ? "bg-blue-500/20 border-blue-400/50"
                    : "bg-white/10 border-white/20 hover:bg-white/20"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.id)}
                      onChange={() => toggleTableSelection(table.id)}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 checked:bg-blue-500 checked:border-blue-500 focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="font-semibold text-sm">
                      表格 {table.id + 1}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => highlightTable(table.id)}
                      className="py-1 px-2 text-xs rounded-md bg-white/20 hover:bg-white/30 transition-transform hover:scale-105"
                    >
                      👁️ 高亮
                    </button>
                    <button
                      onClick={() => copySingleTable(table.id)}
                      disabled={isLoading}
                      className="py-1 px-2 text-xs rounded-md bg-green-500/20 hover:bg-green-500/30 transition-transform hover:scale-105 disabled:opacity-60"
                    >
                      📋 复制
                    </button>
                  </div>
                </div>
                <div className="text-xs opacity-80 bg-white/5 rounded p-2 border-l-2 border-white/20">
                  <div className="font-medium mb-1">预览内容:</div>
                  <div className="text-xs leading-relaxed">
                    {formatTablePreview(table.preview || "无法获取表格内容")}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {selectedTables.size > 0 && (
            <div className="mt-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  已选择 {selectedTables.size} 个表格
                </span>
                <button
                  onClick={copySelectedTables}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/20 hover:bg-blue-500/30 transition-all disabled:opacity-60"
                >
                  📋 复制选中
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

