// 工具函数集合

/**
 * 防抖函数
 * @param func 要防抖的函数
 * @param wait 等待时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 * @param func 要节流的函数
 * @param limit 限制时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 格式化错误信息
 * @param error 错误对象
 * @returns 格式化的错误信息
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '未知错误';
}

/**
 * 检查是否为有效的表格元素
 * @param element 要检查的元素
 * @returns 是否为有效表格
 */
export function isValidTable(element: Element): boolean {
  return element.tagName === 'TABLE' && element.children.length > 0;
}

/**
 * 获取表格信息
 * @param table 表格元素
 * @returns 表格信息对象
 */
export function getTableInfo(table: HTMLTableElement) {
  const rows = table.rows.length;
  const cols = table.rows[0]?.cells.length || 0;
  return { rows, cols };
}

/**
 * 安全地执行异步操作
 * @param operation 要执行的异步操作
 * @param fallback 失败时的回调
 * @returns Promise结果
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  fallback?: (error: Error) => T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    if (fallback) {
      return fallback(errorObj);
    }
    throw errorObj;
  }
}

/**
 * 延迟执行
 * @param ms 延迟时间（毫秒）
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查浏览器是否支持Clipboard API
 * @returns 是否支持
 */
export function supportsClipboardAPI(): boolean {
  return navigator.clipboard !== undefined && window.isSecureContext;
}

/**
 * 生成唯一ID
 * @returns 唯一ID字符串
 */
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
} 