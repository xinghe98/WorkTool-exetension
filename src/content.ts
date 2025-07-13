// 工具函数 - 直接内联，避免ES6模块导入
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
};

const isValidTable = (element: Element): boolean => {
  return element.tagName === 'TABLE' && element.children.length > 0;
};

const getTableInfo = (table: HTMLTableElement) => {
  const rows = table.rows.length;
  const cols = table.rows[0]?.cells.length || 0;
  return { rows, cols };
};

// 提取表格预览内容
const getTablePreview = (table: HTMLTableElement): string => {
  try {
    const cells: string[] = [];
    
    // 遍历表格的前几行和前几列来获取预览内容
    const maxRows = Math.min(3, table.rows.length);
    const maxCols = Math.min(5, table.rows[0]?.cells.length || 0);
    
    for (let i = 0; i < maxRows; i++) {
      const row = table.rows[i];
      if (row) {
        const rowCells: string[] = [];
        for (let j = 0; j < maxCols; j++) {
          const cell = row.cells[j];
          if (cell) {
            // 获取单元格的文本内容，去除多余空格
            const cellText = cell.textContent?.trim() || '';
            if (cellText) {
              rowCells.push(cellText);
            }
          }
        }
        if (rowCells.length > 0) {
          cells.push(rowCells.join(' | '));
        }
      }
    }
    
    return cells.join(' | ');
  } catch (error) {
    console.warn('提取表格预览时出错:', error);
    return '';
  }
};

const supportsClipboardAPI = (): boolean => {
  return navigator.clipboard !== undefined && window.isSecureContext;
};

const safeAsync = async <T>(
  operation: () => Promise<T>,
  fallback?: (error: Error) => T
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    if (fallback) {
      return fallback(errorObj);
    }
    throw errorObj;
  }
};

interface TableInfo {
  id: number;
  rows: number;
  cols: number;
  preview?: string;
}

interface RequestHeader {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
}

interface ChromeRequest {
  action: string;
  tableId?: number;
  selectedIds?: number[];
  headers?: RequestHeader[];
}

interface ChromeResponse {
  status?: string;
  tables?: TableInfo[];
  success?: boolean;
  error?: string;
  copyEnabled?: boolean;
  headers?: RequestHeader[];
}

let foundTables: HTMLTableElement[] = [];
let previouslyHighlighted: HTMLTableElement | null = null;
let copyProtectionDisabled = false;
const originalStyles: Map<CSSStyleRule, string> = new Map();
let customHeaders: RequestHeader[] = [];

// 清理之前的高亮
const clearHighlight = () => {
  if (previouslyHighlighted) {
    previouslyHighlighted.style.outline = "";
    previouslyHighlighted = null;
  }
};

// 高亮指定表格
const highlightTable = (tableId: number) => {
  clearHighlight();
  const table = foundTables[tableId];
  if (table) {
    table.style.outline = "3px solid #007bff";
    table.style.outlineOffset = "2px";
    previouslyHighlighted = table;
  }
};

// 查找页面中的表格
const findTables = (): TableInfo[] => {
  const allTables = Array.from(document.querySelectorAll("table"));
  foundTables = allTables.filter(isValidTable);
  
  return foundTables.map((table, index) => {
    const { rows, cols } = getTableInfo(table);
    const preview = getTablePreview(table);
    return { id: index, rows, cols, preview };
  });
};

// 复制单个表格到剪贴板
const copySingleTableToClipboard = async (tableId: number): Promise<{ success: boolean; error?: string }> => {
  return safeAsync(async () => {
    if (tableId < 0 || tableId >= foundTables.length) {
      return { success: false, error: "表格ID无效" };
    }

    const table = foundTables[tableId];
    const tableInfo = `=== 表格 ${tableId + 1} ===\n`;
    const tableText = tableInfo + table.outerHTML + "\n";

    // 优先使用现代Clipboard API
    if (supportsClipboardAPI()) {
      try {
        await navigator.clipboard.writeText(tableText);
        return { success: true };
      } catch (clipboardError) {
        console.warn("Clipboard API failed, falling back to execCommand:", clipboardError);
      }
    }

    // 降级到execCommand方法
    const textarea = document.createElement("textarea");
    textarea.value = tableText;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    
    try {
      textarea.select();
      const success = document.execCommand("copy");
      return {
        success,
        error: success ? undefined : "execCommand复制失败"
      };
    } catch (error) {
      return { 
        success: false, 
        error: `execCommand错误: ${formatError(error)}` 
      };
    } finally {
      document.body.removeChild(textarea);
    }
  }, (error) => {
    return { success: false, error: `复制失败: ${formatError(error)}` };
  });
};

// 复制选中的表格到剪贴板
const copySelectedTablesToClipboard = async (selectedIds: number[]): Promise<{ success: boolean; error?: string }> => {
  return safeAsync(async () => {
    if (selectedIds.length === 0) {
      return { success: false, error: "没有选择表格" };
    }

    const tablesText = selectedIds
      .map(tableId => {
        if (tableId < 0 || tableId >= foundTables.length) {
          return null;
        }
        const table = foundTables[tableId];
        const tableInfo = `=== 表格 ${tableId + 1} ===\n`;
        return tableInfo + table.outerHTML + "\n";
      })
      .filter(Boolean)
      .join("\n");

    if (!tablesText) {
      return { success: false, error: "没有有效的表格" };
    }

    // 优先使用现代Clipboard API
    if (supportsClipboardAPI()) {
      try {
        await navigator.clipboard.writeText(tablesText);
        return { success: true };
      } catch (clipboardError) {
        console.warn("Clipboard API failed, falling back to execCommand:", clipboardError);
      }
    }

    // 降级到execCommand方法
    const textarea = document.createElement("textarea");
    textarea.value = tablesText;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    
    try {
      textarea.select();
      const success = document.execCommand("copy");
      return {
        success,
        error: success ? undefined : "execCommand复制失败"
      };
    } catch (error) {
      return { 
        success: false, 
        error: `execCommand错误: ${formatError(error)}` 
      };
    } finally {
      document.body.removeChild(textarea);
    }
  }, (error) => {
    return { success: false, error: `复制失败: ${formatError(error)}` };
  });
};

// 复制所有表格到剪贴板
const copyTablesToClipboard = async (): Promise<{ success: boolean; error?: string }> => {
  return safeAsync(async () => {
    if (foundTables.length === 0) {
      return { success: false, error: "没有找到表格" };
    }

    const tablesText = foundTables
      .map((table, index) => {
        const tableInfo = `=== 表格 ${index + 1} ===\n`;
        return tableInfo + table.outerHTML + "\n";
      })
      .join("\n");

    // 优先使用现代Clipboard API
    if (supportsClipboardAPI()) {
      try {
        await navigator.clipboard.writeText(tablesText);
        return { success: true };
      } catch (clipboardError) {
        console.warn("Clipboard API failed, falling back to execCommand:", clipboardError);
      }
    }

    // 降级到execCommand方法
    const textarea = document.createElement("textarea");
    textarea.value = tablesText;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    
    try {
      textarea.select();
      const success = document.execCommand("copy");
      return {
        success,
        error: success ? undefined : "execCommand复制失败"
      };
    } catch (error) {
      return { 
        success: false, 
        error: `execCommand错误: ${formatError(error)}` 
      };
    } finally {
      document.body.removeChild(textarea);
    }
  }, (error) => {
    return { success: false, error: `复制失败: ${formatError(error)}` };
  });
};

// 禁用复制保护
const disableCopyProtection = () => {
  // 移除所有禁止复制和选择的CSS样式
  const styleSheets = Array.from(document.styleSheets);
  styleSheets.forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || sheet.rules);
      rules.forEach(rule => {
        if (rule instanceof CSSStyleRule) {
          const selector = rule.selectorText;
          if (selector && (
            selector.includes('user-select') || 
            selector.includes('-webkit-user-select') ||
            selector.includes('-moz-user-select') ||
            selector.includes('-ms-user-select') ||
            selector.includes('pointer-events') ||
            selector.includes('::selection') ||
            selector.includes('::-moz-selection')
          )) {
            // 保存原始样式
            originalStyles.set(rule, rule.cssText);
            // 移除禁止复制的样式
            rule.style.removeProperty('user-select');
            rule.style.removeProperty('-webkit-user-select');
            rule.style.removeProperty('-moz-user-select');
            rule.style.removeProperty('-ms-user-select');
            rule.style.removeProperty('pointer-events');
          }
        }
      });
    } catch (e) {
      // 跨域样式表可能无法访问
      console.warn('无法访问样式表:', e);
    }
  });

  // 添加允许复制的全局样式
  const allowCopyStyle = document.createElement('style');
  allowCopyStyle.textContent = `
    * {
      -webkit-user-select: auto !important;
      -moz-user-select: auto !important;
      -ms-user-select: auto !important;
      user-select: auto !important;
      -webkit-touch-callout: auto !important;
      -webkit-tap-highlight-color: transparent !important;
    }
    ::selection {
      background: #007bff !important;
      color: white !important;
    }
    ::-moz-selection {
      background: #007bff !important;
      color: white !important;
    }
  `;
  document.head.appendChild(allowCopyStyle);

  // 移除所有禁止复制的事件监听器
  const events = ['copy', 'cut', 'selectstart', 'select', 'contextmenu', 'mousedown', 'mouseup', 'keydown', 'keyup'];
  events.forEach(eventType => {
    document.addEventListener(eventType, (e) => {
      e.stopPropagation();
    }, true);
  });

  // 禁用右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, true);

  // 允许选择文本
  document.addEventListener('selectstart', (e) => {
    e.stopPropagation();
    return true;
  }, true);

  copyProtectionDisabled = true;
  return { success: true, copyEnabled: true };
};

// 启用复制保护
const enableCopyProtection = () => {
  // 恢复原始样式
  originalStyles.forEach((originalStyle, rule) => {
    rule.cssText = originalStyle;
  });
  originalStyles.clear();

  // 移除允许复制的样式
  const allowCopyStyles = document.querySelectorAll('style');
  allowCopyStyles.forEach(style => {
    if (style.textContent && style.textContent.includes('user-select: auto')) {
      style.remove();
    }
  });

  copyProtectionDisabled = false;
  return { success: true, copyEnabled: false };
};

// 切换复制保护状态
const toggleCopyProtection = (): { success: boolean; copyEnabled: boolean; error?: string } => {
  try {
    if (copyProtectionDisabled) {
      return enableCopyProtection();
    } else {
      return disableCopyProtection();
    }
  } catch (error) {
    return { 
      success: false, 
      copyEnabled: copyProtectionDisabled,
      error: formatError(error)
    };
  }
};

// 检查复制状态
const checkCopyStatus = (): { success: boolean; copyEnabled: boolean } => {
  return { 
    success: true, 
    copyEnabled: copyProtectionDisabled 
  };
};

// 应用自定义请求头
const applyHeaders = async (headers: RequestHeader[]): Promise<{ success: boolean; error?: string }> => {
  try {
    customHeaders = headers.filter(h => h.enabled);
    
    // 通过background script应用请求头
    const response = await chrome.runtime.sendMessage({
      action: 'applyHeaders',
      headers: customHeaders
    });
    
    if (response && response.success) {
      console.log('应用请求头成功:', customHeaders);
      return { success: true };
    } else {
      return { 
        success: false, 
        error: response?.error || '应用请求头失败' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: formatError(error) 
    };
  }
};

// 清除所有自定义请求头
const clearHeaders = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    customHeaders = [];
    
    // 通过background script清除请求头
    const response = await chrome.runtime.sendMessage({
      action: 'clearHeaders'
    });
    
    if (response && response.success) {
      console.log('清除所有请求头成功');
      return { success: true };
    } else {
      return { 
        success: false, 
        error: response?.error || '清除请求头失败' 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: formatError(error) 
    };
  }
};

// 获取当前请求头配置
const getHeaders = (): { success: boolean; headers: RequestHeader[] } => {
  return { 
    success: true, 
    headers: customHeaders 
  };
};

// 消息监听器
chrome.runtime.onMessage.addListener((
  request: ChromeRequest, 
  _sender, 
  sendResponse: (response: ChromeResponse) => void
) => {
  try {
    switch (request.action) {
      case "ping": {
        sendResponse({ status: "ready" });
        break;
      }

      case "findTables": {
        const tables = findTables();
        sendResponse({ tables });
        break;
      }

      case "highlightTable": {
        if (request.tableId !== undefined) {
          highlightTable(request.tableId);
        }
        sendResponse({ success: true });
        break;
      }

      case "copyTables": {
        copyTablesToClipboard().then(result => {
          sendResponse(result);
        });
        return true; // 保持消息通道开放
      }

      case "copySingleTable": {
        if (request.tableId !== undefined) {
          copySingleTableToClipboard(request.tableId).then(result => {
            sendResponse(result);
          });
          return true; // 保持消息通道开放
        } else {
          sendResponse({ success: false, error: "缺少表格ID" });
        }
        break;
      }

      case "copySelectedTables": {
        if (request.selectedIds) {
          copySelectedTablesToClipboard(request.selectedIds).then(result => {
            sendResponse(result);
          });
          return true; // 保持消息通道开放
        } else {
          sendResponse({ success: false, error: "缺少选中的表格ID" });
        }
        break;
      }

      case "toggleCopyProtection": {
        const result = toggleCopyProtection();
        sendResponse(result);
        break;
      }

      case "checkCopyStatus": {
        const result = checkCopyStatus();
        sendResponse(result);
        break;
      }

      case "applyHeaders": {
        if (request.headers) {
          applyHeaders(request.headers).then(result => {
            sendResponse(result);
          });
          return true; // 保持消息通道开放
        } else {
          sendResponse({ success: false, error: "缺少请求头数据" });
        }
        break;
      }

      case "clearHeaders": {
        clearHeaders().then(result => {
          sendResponse(result);
        });
        return true; // 保持消息通道开放
        break;
      }

      case "getHeaders": {
        const result = getHeaders();
        sendResponse(result);
        break;
      }

      default: {
        sendResponse({ success: false, error: "未知操作" });
      }
    }
  } catch (error) {
    sendResponse({ success: false, error: formatError(error) });
  }

  return true;
});

// 页面卸载时清理高亮
window.addEventListener("beforeunload", clearHighlight);

// 添加调试日志
console.log("WorkTool Pro Content Script loaded!");
