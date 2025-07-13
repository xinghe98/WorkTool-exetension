// Background script for WorkTool Pro
// 处理请求头修改和网络请求拦截

// 存储自定义请求头
let customHeaders = [];

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'applyHeaders':
      if (request.headers) {
        customHeaders = request.headers;
        console.log('Applied headers:', customHeaders);
        
        // 更新网络请求规则
        updateNetworkRules();
        
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: '缺少请求头数据' });
      }
      break;
      
    case 'clearHeaders':
      customHeaders = [];
      console.log('Cleared headers');
      
      // 清除网络请求规则
      clearNetworkRules();
      
      sendResponse({ success: true });
      break;
      
    case 'getHeaders':
      sendResponse({ success: true, headers: customHeaders });
      break;
      
    default:
      sendResponse({ success: false, error: '未知操作' });
  }
  
  return true; // 保持消息通道开放
});

// 更新网络请求规则
async function updateNetworkRules() {
  try {
    // 首先清除现有规则
    await clearNetworkRules();
    
    if (customHeaders.length === 0) {
      return;
    }
    
    // 创建新的规则
    const rules = customHeaders.map((header, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: "modifyHeaders",
        requestHeaders: [
          {
            header: header.name,
            operation: "set",
            value: header.value
          }
        ]
      },
      condition: {
        urlFilter: "*://*/*",
        resourceTypes: ["main_frame", "sub_frame", "stylesheet", "script", "image", "font", "object", "xmlhttprequest", "ping", "csp_report", "media", "websocket", "other"]
      }
    }));
    
    // 添加规则
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules,
      removeRuleIds: []
    });
    
    console.log('Network rules updated:', rules);
  } catch (error) {
    console.error('Failed to update network rules:', error);
  }
}

// 清除网络请求规则
async function clearNetworkRules() {
  try {
    const rules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIds = rules.map(rule => rule.id);
    
    if (ruleIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [],
        removeRuleIds: ruleIds
      });
      console.log('Cleared network rules');
    }
  } catch (error) {
    console.error('Failed to clear network rules:', error);
  }
}

// 扩展安装时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('WorkTool Pro background script installed');
});

// 扩展启动时的初始化
chrome.runtime.onStartup.addListener(() => {
  console.log('WorkTool Pro background script started');
}); 