import { useState, useCallback, useEffect } from "react";
import type { RequestHeadersProps, RequestHeader } from "../types";

// 默认请求头模板
const DEFAULT_HEADERS: RequestHeader[] = [
  { id: "1", name: "X-Forwarded-For", value: "1.1.1.1", enabled: false },
  { id: "2", name: "User-Agent", value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", enabled: false },
  { id: "3", name: "Accept", value: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", enabled: false },
  { id: "4", name: "Accept-Language", value: "zh-CN,zh;q=0.9,en;q=0.8", enabled: false },
  { id: "5", name: "Accept-Encoding", value: "gzip, deflate, br", enabled: false },
];

// 存储键名
const STORAGE_KEY = "worktool_request_headers";

// 从存储加载请求头配置
const loadHeadersFromStorage = (): RequestHeader[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : DEFAULT_HEADERS;
    }
  } catch (error) {
    console.warn('加载请求头配置失败:', error);
  }
  return DEFAULT_HEADERS;
};

// 保存请求头配置到存储
const saveHeadersToStorage = (headers: RequestHeader[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(headers));
  } catch (error) {
    console.warn('保存请求头配置失败:', error);
  }
};

export function RequestHeaders({
  sendMessage,
  isLoading,
  setIsLoading,
  setMessage,
}: RequestHeadersProps) {
  const [headers, setHeaders] = useState<RequestHeader[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newHeader, setNewHeader] = useState({ name: "", value: "" });
  const [editingValues, setEditingValues] = useState({ name: "", value: "" });

  // 初始化时从存储加载配置
  useEffect(() => {
    setHeaders(loadHeadersFromStorage());
  }, []);

  // 生成唯一ID
  const generateId = useCallback(() => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }, []);

  // 更新headers并保存到存储
  const updateHeaders = useCallback((newHeaders: RequestHeader[]) => {
    setHeaders(newHeaders);
    saveHeadersToStorage(newHeaders);
  }, []);

  // 添加新请求头
  const addHeader = useCallback(() => {
    if (!newHeader.name.trim() || !newHeader.value.trim()) {
      setMessage("请求头名称和值不能为空");
      return;
    }

    const header: RequestHeader = {
      id: generateId(),
      name: newHeader.name.trim(),
      value: newHeader.value.trim(),
      enabled: true,
    };

    updateHeaders([...headers, header]);
    setNewHeader({ name: "", value: "" });
    setMessage("请求头已添加");
  }, [newHeader, generateId, setMessage, headers, updateHeaders]);

  // 删除请求头
  const deleteHeader = useCallback((id: string) => {
    updateHeaders(headers.filter(h => h.id !== id));
    setMessage("请求头已删除");
  }, [headers, updateHeaders, setMessage]);

  // 切换请求头启用状态
  const toggleHeader = useCallback((id: string) => {
    updateHeaders(
      headers.map(h =>
        h.id === id ? { ...h, enabled: !h.enabled } : h
      )
    );
  }, [headers, updateHeaders]);

  // 开始编辑
  const startEdit = useCallback((header: RequestHeader) => {
    setEditingId(header.id);
    setEditingValues({ name: header.name, value: header.value });
  }, []);

  // 保存编辑
  const saveEdit = useCallback((id: string, name: string, value: string) => {
    if (!name.trim() || !value.trim()) {
      setMessage("请求头名称和值不能为空");
      return;
    }

    updateHeaders(
      headers.map(h =>
        h.id === id
          ? { ...h, name: name.trim(), value: value.trim() }
          : h
      )
    );
    setEditingId(null);
    setEditingValues({ name: "", value: "" });
    setMessage("请求头已更新");
  }, [headers, updateHeaders, setMessage]);

  // 取消编辑
  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingValues({ name: "", value: "" });
  }, []);

  // 应用请求头
  const applyHeaders = useCallback(async () => {
    try {
      setIsLoading(true);
      const enabledHeaders = headers.filter(h => h.enabled);
      
      if (enabledHeaders.length === 0) {
        setMessage("请至少启用一个请求头");
        return;
      }

      const response = await sendMessage("applyHeaders", {
        headers: enabledHeaders,
      });

      if (response.error) {
        setMessage(`应用请求头失败: ${response.error}`);
      } else {
        setMessage(`已应用 ${enabledHeaders.length} 个请求头`);
      }
    } catch (error) {
      setMessage(`操作失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [headers, sendMessage, setIsLoading, setMessage]);

  // 清除所有请求头
  const clearHeaders = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // 清除本地状态 - 将所有请求头设置为未启用
      const clearedHeaders = headers.map(header => ({
        ...header,
        enabled: false
      }));
      updateHeaders(clearedHeaders);
      
      // 清除background script中的请求头
      const response = await sendMessage("clearHeaders");

      if (response.error) {
        setMessage(`清除请求头失败: ${response.error}`);
      } else {
        setMessage("已清除所有自定义请求头");
      }
    } catch (error) {
      setMessage(`操作失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [headers, updateHeaders, sendMessage, setIsLoading, setMessage]);

  return (
    <div className="animate-fadeIn">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          🌐 请求头管理
        </h3>
        <p className="text-sm text-white/70 mb-4">
          自定义发送请求时的HTTP头部信息，可以绕过某些网站的限制
        </p>
      </div>

      {/* 添加新请求头 */}
      <div className="mb-6 p-4 rounded-lg backdrop-blur-md border border-white/20 bg-white/10">
        <h4 className="text-sm font-semibold mb-3">添加新请求头</h4>
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              type="text"
              placeholder="请求头名称 (如: User-Agent)"
              value={newHeader.name}
              onChange={(e) => setNewHeader(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50"
            />
            <input
              type="text"
              placeholder="请求头值"
              value={newHeader.value}
              onChange={(e) => setNewHeader(prev => ({ ...prev, value: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-white placeholder-white/50"
            />
          </div>
          <button
            onClick={addHeader}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white text-sm font-medium rounded-md transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
          >
            {isLoading ? "添加中..." : "添加请求头"}
          </button>
        </div>
      </div>

      {/* 请求头列表 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold">请求头列表 ({headers.length})</h4>
          <div className="flex gap-2">
            <button
              onClick={applyHeaders}
              disabled={isLoading}
              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-500/50 text-white text-xs font-medium rounded-md transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? "应用中..." : "应用选中"}
            </button>
            <button
              onClick={clearHeaders}
              disabled={isLoading}
              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-500/50 text-white text-xs font-medium rounded-md transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
            >
              {isLoading ? "清除中..." : "清除全部"}
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-60 overflow-y-auto overflow-x-hidden">
          {headers.map((header) => (
            <div
              key={header.id}
              className={`p-4 rounded-lg backdrop-blur-md border transition-all duration-300 hover:translate-x-1 ${
                header.enabled
                  ? "bg-green-500/20 border-green-400/50"
                  : "bg-white/10 border-white/20 hover:bg-white/20"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={header.enabled}
                    onChange={() => toggleHeader(header.id)}
                    className="w-4 h-4 rounded border-white/30 bg-white/10 checked:bg-green-500 checked:border-green-500 focus:ring-green-500 focus:ring-2"
                  />
                  <span className="font-semibold text-sm text-white break-all overflow-hidden">
                    {header.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(header)}
                    className="p-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded transition-all duration-300 hover:scale-110"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteHeader(header.id)}
                    className="p-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-all duration-300 hover:scale-110"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              {editingId === header.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editingValues.name}
                    onChange={(e) => setEditingValues(prev => ({ ...prev, name: e.target.value }))}
                    data-header-id={header.id}
                    data-field="name"
                    className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveEdit(header.id, editingValues.name, editingValues.value);
                      }
                    }}
                  />
                  <input
                    type="text"
                    value={editingValues.value}
                    onChange={(e) => setEditingValues(prev => ({ ...prev, value: e.target.value }))}
                    data-header-id={header.id}
                    data-field="value"
                    className="w-full px-2 py-1 text-sm bg-white/10 border border-white/20 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        saveEdit(header.id, editingValues.name, editingValues.value);
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        saveEdit(header.id, editingValues.name, editingValues.value);
                      }}
                      className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-all duration-300"
                    >
                      保存
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded transition-all duration-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/80 break-all overflow-hidden">
                  {header.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 使用说明 */}
      <div className="p-4 rounded-lg backdrop-blur-md border border-white/20 bg-white/10">
        <h4 className="text-sm font-semibold mb-2">💡 使用说明</h4>
        <ul className="text-xs text-white/70 space-y-1">
          <li>• 启用需要的请求头，然后点击"应用选中"</li>
          <li>• 常用的请求头包括：User-Agent、Accept、Referer等</li>
          <li>• 修改请求头可能绕过某些网站的访问限制</li>
          <li>• 某些网站可能会检测异常的请求头</li>
          <li>• 配置会自动保存，关闭弹窗后不会丢失</li>
        </ul>
      </div>
    </div>
  );
} 