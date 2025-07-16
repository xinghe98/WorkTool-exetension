// 导入类型定义
import type { TableInfo } from './types';
import type { RequestHeader } from './types';

// 类型定义
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

// 全局变量声明
let foundTables: HTMLTableElement[] = [];
let lastTableCount = 0;
let detectionAttempts = 0;
const MAX_DETECTION_ATTEMPTS = 15; // 增加最大尝试次数
let copyProtectionDisabled = false;
let backgroundReady = false;

// 工具函数
const formatError = (error: any): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const supportsClipboardAPI = (): boolean => {
  return navigator.clipboard && typeof navigator.clipboard.writeText === 'function';
};

// 改进的防抖函数 - 支持立即执行
const debounce = (func: Function, wait: number, immediate = false) => {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: any[]) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    const callNow = immediate && !timeout;
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func(...args);
  };
};

// 连接重试逻辑 - 增强版
const sendMessageWithRetry = async (message: any, maxRetries = 5): Promise<any> => { // 增加重试次数
  // 首先检查background是否就绪
  if (!backgroundReady && message.action !== 'ping') {
    try {
      const pingResponse = await chrome.runtime.sendMessage({ action: 'ping' });
      backgroundReady = pingResponse?.success || pingResponse?.status === 'ready';
    } catch (error) {
      // 错误处理
    }
  }

  // 使用指数退避算法
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      
      // 指数退避: 1秒, 2秒, 4秒, 8秒...
      const waitTime = 1000 * Math.pow(2, i);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// 多重检测策略 - 增强版
const performTableDetection = async () => {
  try {
    // 使用更宽松的表格查找策略
    const tablesInfo = findTables(true); // 传入true表示使用宽松模式
    const currentTableCount = tablesInfo.length;
    
    // 如果表格数量发生变化或者是首次检测，发送更新
    if (currentTableCount !== lastTableCount || detectionAttempts === 0) {
      lastTableCount = currentTableCount;
      try {
        await sendMessageWithRetry({
          action: "updateTables",
          tables: tablesInfo,
        });
      } catch (error) {
        // 消息发送失败不应该阻止继续检测
      }
    }
    
    detectionAttempts++;
    
    // 如果还没找到表格且尝试次数未达到上限，继续尝试
    if (currentTableCount === 0 && detectionAttempts < MAX_DETECTION_ATTEMPTS) {
      // 使用指数退避算法增加间隔时间
      const nextInterval = Math.min(2000 * Math.pow(1.5, detectionAttempts - 1), 10000);
      setTimeout(performTableDetection, nextInterval);
    }
  } catch (error) {
    // 即使检测失败，也应该继续尝试
    if (detectionAttempts < MAX_DETECTION_ATTEMPTS) {
      setTimeout(performTableDetection, 3000);
    }
  }
};

// 防抖的表格更新函数
const debouncedUpdateTables = debounce(performTableDetection, 800); // 略微减少防抖时间

// 立即执行的表格检测
const immediateTableDetection = debounce(performTableDetection, 50, true); // 减少延迟

// 改进的MutationObserver - 更精确的变化检测
const observer = new MutationObserver((mutationsList) => {
  let shouldUpdate = false;
  let hasSignificantChange = false;
  
  for (const mutation of mutationsList) {
    // 检查属性变化 - 某些表格可能通过改变style或class显示
    if (mutation.type === "attributes" && 
        (mutation.attributeName === "style" || 
         mutation.attributeName === "class" || 
         mutation.attributeName === "hidden")) {
      const target = mutation.target as Element;
      if (target.tagName === 'TABLE' || target.closest('table')) {
        shouldUpdate = true;
      }
    }
    
    // 检查DOM结构变化
    if (mutation.type === "childList") {
      const addedNodes = Array.from(mutation.addedNodes);
      const removedNodes = Array.from(mutation.removedNodes);
      
      // 检查是否有表格相关的变化 - 更全面的检测
      const hasTableChanges = [...addedNodes, ...removedNodes].some(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // 更全面的表格相关元素检测
          return element.tagName === 'TABLE' || 
                 element.tagName === 'TR' ||
                 element.tagName === 'TD' ||
                 element.tagName === 'TH' ||
                 element.querySelector('table,tr,td,th') !== null ||
                 element.closest('table') !== null ||
                 element.tagName === 'IFRAME' || 
                 element.classList.contains('table') ||
                 element.id?.includes('table') ||
                 element.id?.includes('grid') ||
                 element.className?.includes('grid') ||
                 element.className?.includes('table') ||
                 element.getAttribute('role') === 'grid' ||
                 element.getAttribute('role') === 'table';
        }
        return false;
      });
      
      if (hasTableChanges) {
        shouldUpdate = true;
        // 如果是新增的表格或iframe，标记为重要变化
        if (addedNodes.some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          ((node as Element).tagName === 'TABLE' || 
           (node as Element).tagName === 'IFRAME' ||
           (node as Element).querySelector('table') !== null)
        )) {
          hasSignificantChange = true;
        }
      }
    }
  }
  
  if (shouldUpdate) {
    if (hasSignificantChange) {
      // 重要变化立即检测
      immediateTableDetection();
    } else {
      // 一般变化使用防抖
      debouncedUpdateTables();
    }
  }
});

// 更宽松的表格验证函数
const isValidTable = (table: HTMLTableElement, relaxedMode = false): boolean => {
  try {
    // 1. 基本存在性检查
    if (!table || !table.rows) {
      return false;
    }

    // 2. 更宽松的可见性检查
    const rect = table.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(table);
    
    // 宽松模式下，只排除完全隐藏的表格
    if (computedStyle.display === 'none' || 
        computedStyle.visibility === 'hidden') {
      return false;
    }

    // 3. 降低内容要求
    if (table.rows.length < 1) {
      return false;
    }

    // 4. 更宽松的单元格检查
    let hasAnyContent = false;
    
    // 宽松模式下，只检查是否有基本结构
    if (relaxedMode) {
      if (table.rows.length >= 1 && table.rows[0]?.cells.length >= 1) {
        hasAnyContent = true;
      }
    } else {
      // 标准模式，检查内容
      for (let i = 0; i < Math.min(5, table.rows.length); i++) {
        const row = table.rows[i];
        if (row && row.cells.length > 0) {
          for (let j = 0; j < Math.min(10, row.cells.length); j++) {
            const cell = row.cells[j];
            if (cell) {
              const content = cell.textContent?.trim() || cell.innerHTML?.trim();
              if (content && content.length > 0) {
                hasAnyContent = true;
                break;
              }
            }
          }
          if (hasAnyContent) break;
        }
      }

      // 即使没有文本内容，如果有足够的结构也认为是有效表格
      if (!hasAnyContent) {
        // 检查是否有足够的表格结构
        if (table.rows.length >= 2 && table.rows[0]?.cells.length >= 2) {
          hasAnyContent = true; // 有结构就认为有效
        }
      }
    }

    if (!hasAnyContent) {
      return false;
    }

    // 5. 减少排除条件，只排除明显的UI组件
    // 宽松模式下，减少排除条件
    if (!relaxedMode) {
      if (table.closest(".ui-datepicker")) {
        return false;
      }
    }

    // 6. 降低尺寸要求
    if (rect.width < 10 || rect.height < 5) { // 进一步降低尺寸要求
      return false;
    }

    return true;
  } catch (error) {
    // 宽松模式下，验证出错也返回true
    return relaxedMode;
  }
};

const getTableInfo = (table: HTMLTableElement) => {
  const rows = table.rows.length;
  const cols = table.rows[0]?.cells.length || 0;
  return { rows, cols };
};

// 改进的表格预览函数
const getTablePreview = (table: HTMLTableElement): string => {
  try {
    const cells: string[] = [];
    const maxRows = Math.min(3, table.rows.length);
    const maxCols = Math.min(5, table.rows[0]?.cells.length || 0);

    for (let i = 0; i < maxRows; i++) {
      const row = table.rows[i];
      if (row) {
        const rowCells: string[] = [];
        for (let j = 0; j < maxCols; j++) {
          const cell = row.cells[j];
          if (cell) {
            let cellText = cell.textContent?.trim() || "";
            
            // 如果没有文本内容，尝试获取其他信息
            if (!cellText) {
              const inputs = cell.querySelectorAll('input, select, textarea');
              if (inputs.length > 0) {
                cellText = `[${inputs.length}个输入控件]`;
              } else if (cell.innerHTML.trim()) {
                cellText = "[HTML内容]";
              }
            }
            
            // 改进的编码检测
            if (cellText) {
              // 检查是否包含中文
              if (/[\u4e00-\u9fa5]/.test(cellText)) {
                // 包含中文，保持原样
              } else if (/[^\x00-\x7F]/.test(cellText)) {
                // 包含非ASCII字符但不是中文，可能是乱码
                if (cellText.length > 10) {
                  cellText = "[编码问题]";
                }
              }
              
              // 限制单元格预览长度
              if (cellText.length > 15) {
                cellText = cellText.substring(0, 15) + "...";
              }
              
              if (cellText && cellText !== "[编码问题]") {
                rowCells.push(cellText);
              }
            }
          }
        }
        if (rowCells.length > 0) {
          cells.push(rowCells.join(" | "));
        }
      }
    }

    const preview = cells.length > 0 ? cells.join(" | ") : "无有效内容";
    const tableId = table.id ? `#${table.id}` : '';
    const tableClass = table.className ? `.${table.className.split(' ')[0]}` : '';
    const location = tableId || tableClass || '未命名表格';
    
    return `${location}: ${preview}`;
  } catch (error) {
    return "预览获取失败";
  }
};

// 增强的表格查找函数
const findTables = (relaxedMode = false): TableInfo[] => {
  try {
    const allTables: HTMLTableElement[] = [];
    const processedTables = new Set<HTMLTableElement>(); // 用于去重
    
    // 1. 查找主文档中的表格
    const mainTables = Array.from(document.querySelectorAll("table")) as HTMLTableElement[];
    mainTables.forEach(table => {
      if (!processedTables.has(table)) {
        allTables.push(table);
        processedTables.add(table);
      }
    });
    
    // 2. 查找iframe中的表格（如果可访问）
    const iframes = Array.from(document.querySelectorAll("iframe"));
    iframes.forEach((iframe, _) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeTables = Array.from(iframeDoc.querySelectorAll("table")) as HTMLTableElement[];
          iframeTables.forEach(table => {
            if (!processedTables.has(table)) {
              allTables.push(table);
              processedTables.add(table);
            }
          });
        }
      } catch (e) {
        // 跨域iframe无法访问，忽略错误
      }
    });
    
    // 3. 查找可能的动态表格容器 - 扩展选择器
    const potentialContainers = document.querySelectorAll(
      '[class*="table"], [class*="grid"], [class*="data"], [id*="table"], [id*="grid"], ' +
      '[role="grid"], [role="table"], .ant-table, .el-table, .layui-table, .ivu-table, ' +
      '.dx-datagrid, .ag-root, .k-grid, .jqgrid, .dataTables'
    );
    potentialContainers.forEach(container => {
      const tables = Array.from(container.querySelectorAll("table")) as HTMLTableElement[];
      tables.forEach(table => {
        if (!processedTables.has(table)) {
          allTables.push(table);
          processedTables.add(table);
        }
      });
    });
    
    // 4. 过滤有效表格
    foundTables = allTables.filter(table => isValidTable(table, relaxedMode));
    
    // 5. 生成表格信息
    return foundTables.map((table, index) => {
      const { rows, cols } = getTableInfo(table);
      const preview = getTablePreview(table);
      return { id: index, rows, cols, preview };
    });
  } catch (error) {
    return [];
  }
};

// 高亮表格函数
const highlightTable = (tableId: number): void => {
  try {
    // 清除之前的高亮
    clearHighlight();
    
    if (tableId >= 0 && tableId < foundTables.length) {
      const table = foundTables[tableId];
      table.style.outline = '3px solid #ff6b6b';
      table.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
      
      // 滚动到表格位置
      table.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (error) {
    // 错误处理
  }
};

// 清除高亮函数
const clearHighlight = (): void => {
  try {
    foundTables.forEach(table => {
      table.style.outline = '';
      table.style.backgroundColor = '';
    });
  } catch (error) {
    // 错误处理
  }
};

// 复制表格到剪贴板 - 改进版
const copyTablesToClipboard = async (): Promise<ChromeResponse> => {
  try {
    if (foundTables.length === 0) {
      return { success: false, error: "没有找到表格" };
    }

    const tableHtml = foundTables.map(table => table.outerHTML).join('\n\n');
    
    // 尝试使用Clipboard API
    if (supportsClipboardAPI()) {
      try {
        // 创建一个临时按钮并点击它以确保页面获得焦点
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.opacity = '0';
        tempButton.style.pointerEvents = 'none';
        document.body.appendChild(tempButton);
        tempButton.focus();
        tempButton.click();
        
        // 尝试复制
        await navigator.clipboard.writeText(tableHtml);
        document.body.removeChild(tempButton);
        return { success: true };
      } catch (clipboardError) {
        // 如果Clipboard API失败，降级到传统方法
      }
    }
    
    // 降级到传统方法
    const textArea = document.createElement('textarea');
    textArea.value = tableHtml;
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      return { success: false, error: "复制命令执行失败，请确保页面处于活动状态" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 复制单个表格 - 改进版
const copySingleTableToClipboard = async (tableId: number): Promise<ChromeResponse> => {
  try {
    if (tableId < 0 || tableId >= foundTables.length) {
      return { success: false, error: "无效的表格ID" };
    }

    const table = foundTables[tableId];
    const tableHtml = table.outerHTML;
    
    // 尝试使用Clipboard API
    if (supportsClipboardAPI()) {
      try {
        // 创建一个临时按钮并点击它以确保页面获得焦点
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.opacity = '0';
        tempButton.style.pointerEvents = 'none';
        document.body.appendChild(tempButton);
        tempButton.focus();
        tempButton.click();
        
        // 尝试复制
        await navigator.clipboard.writeText(tableHtml);
        document.body.removeChild(tempButton);
        return { success: true };
      } catch (clipboardError) {
        // 如果Clipboard API失败，降级到传统方法
      }
    }
    
    // 降级到传统方法
    const textArea = document.createElement('textarea');
    textArea.value = tableHtml;
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      return { success: false, error: "复制命令执行失败，请确保页面处于活动状态" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 复制选中的表格 - 改进版
const copySelectedTablesToClipboard = async (selectedIds: number[]): Promise<ChromeResponse> => {
  try {
    if (selectedIds.length === 0) {
      return { success: false, error: "没有选中的表格" };
    }

    const selectedTables = selectedIds
      .filter(id => id >= 0 && id < foundTables.length)
      .map(id => foundTables[id]);

    if (selectedTables.length === 0) {
      return { success: false, error: "选中的表格ID无效" };
    }

    const tableHtml = selectedTables.map(table => table.outerHTML).join('\n\n');
    
    // 尝试使用Clipboard API
    if (supportsClipboardAPI()) {
      try {
        // 创建一个临时按钮并点击它以确保页面获得焦点
        const tempButton = document.createElement('button');
        tempButton.style.position = 'fixed';
        tempButton.style.opacity = '0';
        tempButton.style.pointerEvents = 'none';
        document.body.appendChild(tempButton);
        tempButton.focus();
        tempButton.click();
        
        // 尝试复制
        await navigator.clipboard.writeText(tableHtml);
        document.body.removeChild(tempButton);
        return { success: true };
      } catch (clipboardError) {
        // 如果Clipboard API失败，降级到传统方法
      }
    }
    
    // 降级到传统方法
    const textArea = document.createElement('textarea');
    textArea.value = tableHtml;
    textArea.style.position = 'fixed';
    textArea.style.left = '0';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (!successful) {
      return { success: false, error: "复制命令执行失败，请确保页面处于活动状态" };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 禁用复制保护
const disableCopyProtection = (): void => {
  try {
    // 移除阻止复制的CSS规则
    const styleSheets = Array.from(document.styleSheets);
    styleSheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || sheet.rules || []);
        rules.forEach((rule, index) => {
          const cssRule = rule as CSSStyleRule;
          if (cssRule.style && (
            cssRule.style.userSelect === 'none' ||
            cssRule.style.webkitUserSelect === 'none' ||
            cssRule.style.userSelect === 'none'
          )) {
            sheet.deleteRule(index);
          }
        });
      } catch (e) {
        // 跨域样式表无法访问，忽略错误
      }
    });

    // 添加全局样式启用选择
    const style = document.createElement('style');
    style.textContent = `
      * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
    `;
    document.head.appendChild(style);
    
    copyProtectionDisabled = true;
  } catch (error) {
    // 错误处理
  }
};

// 启用复制保护
const enableCopyProtection = (): void => {
  try {
    // 移除之前添加的样式
    const styles = document.querySelectorAll('style');
    styles.forEach(style => {
      if (style.textContent?.includes('user-select: text !important')) {
        style.remove();
      }
    });
    
    copyProtectionDisabled = false;
  } catch (error) {
    // 错误处理
  }
};

// 切换复制保护
const toggleCopyProtection = (): ChromeResponse => {
  try {
    if (copyProtectionDisabled) {
      enableCopyProtection();
    } else {
      disableCopyProtection();
    }
    
    return { success: true, copyEnabled: copyProtectionDisabled };
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 检查复制状态
const checkCopyStatus = (): ChromeResponse => {
  return { success: true, copyEnabled: copyProtectionDisabled };
};

// 应用请求头
const applyHeaders = async (headers: RequestHeader[]): Promise<ChromeResponse> => {
  try {
    const response = await sendMessageWithRetry({
      action: "applyHeaders",
      headers: headers
    });
    return response;
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 清除请求头
const clearHeaders = async (): Promise<ChromeResponse> => {
  try {
    const response = await sendMessageWithRetry({
      action: "clearHeaders"
    });
    return response;
  } catch (error) {
    return { success: false, error: formatError(error) };
  }
};

// 获取请求头
const getHeaders = (): ChromeResponse => {
  // 这里应该从存储中获取请求头，暂时返回空数组
  return { success: true, headers: [] };
};

// 多重页面加载检测 - 增强版
const initializeTableDetection = () => {
  // 重置检测计数
  detectionAttempts = 0;
  lastTableCount = 0;
  
  // 检查background是否就绪
  sendMessageWithRetry({ action: 'ping' }, 3)
    .then(response => {
      backgroundReady = response?.success || response?.status === 'ready';
    })
    .catch(() => {
      // 即使ping失败也继续初始化
    })
    .finally(() => {
      // 设置更全面的MutationObserver
      observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: true, // 添加属性监听
        attributeFilter: ['style', 'class', 'hidden'], // 只监听这些属性
        characterData: false
      });
      
      // 立即检测一次
      immediateTableDetection();
      
      // 延迟检测 - 处理异步加载的内容，使用更多的检测点和变化的间隔
      setTimeout(performTableDetection, 500);
      setTimeout(performTableDetection, 1500);
      setTimeout(performTableDetection, 3000);
      setTimeout(performTableDetection, 5000);
      setTimeout(performTableDetection, 8000);
    });
};

// 添加定期轮询机制
const startTablePolling = () => {
  // 每30秒轮询一次，以防事件驱动的检测错过表格
  const pollingInterval = setInterval(() => {
    // 只有当页面可见时才执行轮询
    if (!document.hidden) {
      performTableDetection();
    }
  }, 30000);
  
  // 页面卸载时清理轮询
  window.addEventListener('beforeunload', () => {
    clearInterval(pollingInterval);
  });
};

// 多个时机初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeTableDetection();
    // 启动轮询
    startTablePolling();
  });
} else {
  initializeTableDetection();
  // 启动轮询
  startTablePolling();
}

window.addEventListener("load", () => {
  // 页面完全加载后再检测
  setTimeout(performTableDetection, 1000);
  setTimeout(performTableDetection, 3000);
});

// 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // 页面变为可见时重新检测
    setTimeout(performTableDetection, 500);
  }
});

// 页面卸载时清理
window.addEventListener("beforeunload", () => {
  clearHighlight();
  if (observer) {
    observer.disconnect();
  }
});

// 消息监听器 - 增强版
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener(
    (
      request: ChromeRequest,
      _sender,
      sendResponse: (response: ChromeResponse) => void,
    ) => {
      try {
        switch (request.action) {
          case "ping": {
            sendResponse({ status: "ready" });
            break;
          }

          case "findTables": {
            // 强制重新检测表格
            const tables = findTables(true); // 使用宽松模式
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
            copyTablesToClipboard().then((result) => {
              sendResponse(result);
            }).catch((error) => {
              sendResponse({ success: false, error: formatError(error) });
            });
            return true;
          }

          case "copySingleTable": {
            if (request.tableId !== undefined) {
              copySingleTableToClipboard(request.tableId).then((result) => {
                sendResponse(result);
              }).catch((error) => {
                sendResponse({ success: false, error: formatError(error) });
              });
              return true;
            } else {
              sendResponse({ success: false, error: "缺少表格ID" });
            }
            break;
          }

          case "copySelectedTables": {
            if (request.selectedIds) {
              copySelectedTablesToClipboard(request.selectedIds).then(
                (result) => {
                  sendResponse(result);
                }
              ).catch((error) => {
                sendResponse({ success: false, error: formatError(error) });
              });
              return true;
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
              applyHeaders(request.headers).then((result) => {
                sendResponse(result);
              }).catch((error) => {
                sendResponse({ success: false, error: formatError(error) });
              });
              return true;
            } else {
              sendResponse({ success: false, error: "缺少请求头数据" });
            }
            break;
          }

          case "clearHeaders": {
            clearHeaders().then((result) => {
              sendResponse(result);
            }).catch((error) => {
              sendResponse({ success: false, error: formatError(error) });
            });
            return true;
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
    },
  );
} else {
  console.error('Chrome runtime not available');
}

console.log("WorkTool Pro Content Script loaded with enhanced detection!");
