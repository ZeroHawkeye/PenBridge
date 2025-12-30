/**
 * 通用鉴权按钮 UI 模块
 * 用于在各平台登录窗口中注入统一的鉴权按钮和消息提示
 */

import type { BrowserWindow } from "electron";

// 平台主题配置
export interface PlatformTheme {
  // 平台名称
  name: string;
  // 主色调（渐变起始色）
  primaryColor: string;
  // 渐变结束色
  secondaryColor: string;
  // 按钮文字颜色
  buttonTextColor: string;
}

// 预定义的平台主题
export const PLATFORM_THEMES: Record<string, PlatformTheme> = {
  juejin: {
    name: "掘金",
    primaryColor: "#1e80ff",
    secondaryColor: "#007fff",
    buttonTextColor: "#1e80ff",
  },
  tencent: {
    name: "腾讯云",
    primaryColor: "#667eea",
    secondaryColor: "#764ba2",
    buttonTextColor: "#667eea",
  },
  // 后续可以添加更多平台
  // csdn: { ... },
  // zhihu: { ... },
};

/**
 * 生成注入的鉴权按钮脚本
 * @param theme 平台主题配置
 * @returns 注入脚本字符串
 */
export function generateAuthButtonScript(theme: PlatformTheme): string {
  return `
    (function() {
      // 防止重复注入
      if (document.getElementById('penbridge-auth-banner')) return;

      // 创建右下角悬浮面板
      const banner = document.createElement('div');
      banner.id = 'penbridge-auth-banner';
      banner.style.cssText = \`
        position: fixed !important;
        bottom: 24px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        background: linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%) !important;
        color: white !important;
        padding: 16px 20px !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25) !important;
        border-radius: 12px !important;
        max-width: 280px !important;
      \`;

      // 提示文字
      const text = document.createElement('span');
      text.textContent = '请先完成登录，然后点击「获取鉴权」按钮';
      text.id = 'penbridge-auth-text';
      text.style.cssText = 'font-size: 13px !important; font-weight: 500 !important; color: white !important; text-align: center !important; line-height: 1.4 !important;';

      // 按钮容器
      const btnContainer = document.createElement('div');
      btnContainer.style.cssText = 'display: flex !important; gap: 10px !important; width: 100% !important;';

      // 获取鉴权按钮
      const authBtn = document.createElement('button');
      authBtn.textContent = '🔐 获取鉴权';
      authBtn.style.cssText = \`
        background: white !important;
        color: ${theme.buttonTextColor} !important;
        border: none !important;
        padding: 10px 16px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        flex: 1 !important;
      \`;
      authBtn.onmouseover = function() {
        this.style.transform = 'scale(1.02)';
        this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
      };
      authBtn.onmouseout = function() {
        this.style.transform = 'scale(1)';
        this.style.boxShadow = 'none';
      };
      authBtn.onclick = function() {
        authBtn.textContent = '⏳ 获取中...';
        authBtn.disabled = true;
        window.__PENBRIDGE_ACTION__ = 'EXTRACT_AUTH';
      };

      // 取消按钮
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '✕';
      cancelBtn.title = '取消';
      cancelBtn.style.cssText = \`
        background: rgba(255, 255, 255, 0.2) !important;
        color: white !important;
        border: 1px solid rgba(255, 255, 255, 0.3) !important;
        padding: 10px 14px !important;
        border-radius: 8px !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
      \`;
      cancelBtn.onmouseover = function() {
        this.style.background = 'rgba(255, 255, 255, 0.3)';
      };
      cancelBtn.onmouseout = function() {
        this.style.background = 'rgba(255, 255, 255, 0.2)';
      };
      cancelBtn.onclick = function() {
        window.__PENBRIDGE_ACTION__ = 'CANCEL_AUTH';
      };

      btnContainer.appendChild(authBtn);
      btnContainer.appendChild(cancelBtn);
      banner.appendChild(text);
      banner.appendChild(btnContainer);
      document.body.appendChild(banner);
    })();
  `;
}

/**
 * 生成消息提示脚本
 * @param message 消息内容
 * @param type 消息类型
 * @returns 注入脚本字符串
 */
export function generateMessageScript(
  message: string,
  type: "success" | "error" | "info"
): string {
  const colorMap = {
    success: "#10b981",
    error: "#ef4444",
    info: "#3b82f6",
  };

  return `
    (function() {
      // 移除旧消息
      const old = document.getElementById('penbridge-message');
      if (old) old.remove();

      const msg = document.createElement('div');
      msg.id = 'penbridge-message';
      msg.textContent = '${message}';
      msg.style.cssText = \`
        position: fixed;
        bottom: 120px;
        right: 24px;
        z-index: 2147483648;
        background: ${colorMap[type]};
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: fadeIn 0.3s ease;
        max-width: 280px;
      \`;

      document.body.appendChild(msg);

      // 3秒后自动消失
      setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transition = 'opacity 0.3s';
        setTimeout(() => msg.remove(), 300);
      }, 3000);
    })();
  `;
}

/**
 * 生成动作轮询脚本
 * @returns 注入脚本字符串
 */
export function generateActionPollingScript(): string {
  return `
    (function() {
      const action = window.__PENBRIDGE_ACTION__;
      if (action) {
        window.__PENBRIDGE_ACTION__ = null;
      }
      return action;
    })();
  `;
}

/**
 * 注入鉴权按钮到登录窗口
 * @param loginWindow 登录窗口
 * @param theme 平台主题配置
 */
export function injectAuthButton(
  loginWindow: BrowserWindow | null,
  theme: PlatformTheme
): void {
  if (!loginWindow || loginWindow.isDestroyed()) return;

  const script = generateAuthButtonScript(theme);
  loginWindow.webContents.executeJavaScript(script).catch((err) => {
    console.error("注入鉴权按钮脚本失败:", err);
  });
}

/**
 * 注入消息提示到登录窗口
 * @param loginWindow 登录窗口
 * @param message 消息内容
 * @param type 消息类型
 */
export function injectMessage(
  loginWindow: BrowserWindow | null,
  message: string,
  type: "success" | "error" | "info"
): void {
  if (!loginWindow || loginWindow.isDestroyed()) return;

  const script = generateMessageScript(message, type);
  loginWindow.webContents.executeJavaScript(script).catch(() => {});
}

/**
 * 设置动作轮询
 * @param loginWindow 登录窗口
 * @param onExtractAuth 获取鉴权回调
 * @param onCancel 取消回调
 * @returns 清理函数
 */
export function setupActionPolling(
  loginWindow: BrowserWindow | null,
  onExtractAuth: () => void,
  onCancel: () => void
): () => void {
  if (!loginWindow || loginWindow.isDestroyed()) {
    return () => {};
  }

  const script = generateActionPollingScript();

  // 轮询检查页面中的动作变量
  const pollInterval = setInterval(async () => {
    if (!loginWindow || loginWindow.isDestroyed()) {
      clearInterval(pollInterval);
      return;
    }

    try {
      const action = await loginWindow.webContents.executeJavaScript(script);

      if (action === "EXTRACT_AUTH") {
        console.log("检测到获取鉴权动作");
        onExtractAuth();
        clearInterval(pollInterval);
      } else if (action === "CANCEL_AUTH") {
        console.log("检测到取消动作");
        onCancel();
        clearInterval(pollInterval);
      }
    } catch {
      // 页面可能正在导航，忽略错误
    }
  }, 200);

  // 返回清理函数
  return () => {
    clearInterval(pollInterval);
  };
}
