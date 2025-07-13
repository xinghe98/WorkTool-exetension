// Chrome API 相关类型
export interface ChromeMessageResponse {
  status?: string;
  tables?: TableInfo[];
  success?: boolean;
  error?: string;
  copyEnabled?: boolean;
}

export interface ChromeMessageData {
  [key: string]: unknown;
}

// 表格相关类型
export interface TableInfo {
  id: number;
  rows: number;
  cols: number;
  preview?: string;
}

// 组件Props类型
export interface TableToolsProps {
  sendMessage: (action: string, data?: ChromeMessageData) => Promise<ChromeMessageResponse>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setMessage: (message: string) => void;
}

export interface CopyToolsProps {
  sendMessage: (action: string, data?: ChromeMessageData) => Promise<ChromeMessageResponse>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setMessage: (message: string) => void;
} 