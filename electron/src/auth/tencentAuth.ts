import { BrowserWindow, session } from "electron";
import type { Cookie } from "electron";

// 腾讯云相关 URL
const TENCENT_DEVELOPER_URL = "https://cloud.tencent.com/developer";
const TENCENT_DOMAIN = ".cloud.tencent.com";

export interface UserInfo {
  nickname?: string;
  avatarUrl?: string;
  isLoggedIn: boolean;
}

export interface LoginResult {
  success: boolean;
  message: string;
  user?: UserInfo;
}

export class TencentAuth {
  private store: any;
  private loginWindow: BrowserWindow | null = null;
  private isResolved: boolean = false; // 防止重复 resolve
  private loginDetected: boolean = false; // 是否检测到登录
  private extractAuthCallback: (() => void) | null = null; // 获取鉴权的回调

  constructor(store: any) {
    this.store = store;
  }

  // 获取登录状态
  getLoginStatus(): { isLoggedIn: boolean; user?: UserInfo } {
    const cookies = this.store.get("cookies") as Cookie[] | undefined;
    const userInfo = this.store.get("userInfo") as UserInfo | undefined;

    if (cookies && cookies.length > 0 && userInfo?.isLoggedIn) {
      return {
        isLoggedIn: true,
        user: userInfo,
      };
    }

    return { isLoggedIn: false };
  }

  // 获取存储的 cookies
  getCookies(): string | null {
    const cookies = this.store.get("cookies") as Cookie[] | undefined;
    if (cookies && cookies.length > 0) {
      return JSON.stringify(cookies);
    }
    return null;
  }

  // 打开登录窗口
  async openLoginWindow(
    parentWindow: BrowserWindow | null
  ): Promise<LoginResult> {
    // 重置状态
    this.isResolved = false;
    this.loginDetected = false;

    return new Promise((resolve) => {
      // 包装 resolve，防止重复调用
      const safeResolve = (result: LoginResult) => {
        if (!this.isResolved) {
          this.isResolved = true;
          resolve(result);
        }
      };

      // 如果登录窗口已存在，聚焦它
      if (this.loginWindow && !this.loginWindow.isDestroyed()) {
        this.loginWindow.focus();
        safeResolve({ success: false, message: "登录窗口已打开" });
        return;
      }

      // 创建独立的 session，避免影响主窗口
      const loginSession = session.fromPartition("persist:tencent-login");

      // 创建登录窗口
      this.loginWindow = new BrowserWindow({
        width: 900,
        height: 700,
        parent: parentWindow || undefined,
        modal: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          session: loginSession,
        },
        title: "登录腾讯云",
      });

      // 监听用户点击"获取鉴权"按钮
      const handleExtractAuth = async () => {
        if (this.isResolved) return;

        try {
          const cookies = await this.extractAllCookies(loginSession);
          if (cookies.length > 0) {
            console.log("用户手动获取鉴权，cookies 数量:", cookies.length);

            // 保存 cookies 和用户信息
            const userInfo: UserInfo = { isLoggedIn: true };
            this.store.set("cookies", cookies);
            this.store.set("userInfo", userInfo);

            // 关闭登录窗口
            if (this.loginWindow && !this.loginWindow.isDestroyed()) {
              this.loginWindow.close();
            }

            safeResolve({
              success: true,
              message: "登录成功",
              user: userInfo,
            });
          } else {
            // 注入提示
            this.injectMessage("未检测到有效的登录信息，请先完成登录", "error");
          }
        } catch (error) {
          console.error("获取鉴权失败:", error);
          this.injectMessage("获取鉴权失败，请重试", "error");
        }
      };

      // 保存回调以便后续调用
      this.extractAuthCallback = handleExtractAuth;

      // 设置动作轮询
      this.setupActionPolling();

      // 加载腾讯云开发者社区页面
      this.loginWindow.loadURL(TENCENT_DEVELOPER_URL);

      // 页面加载完成后注入按钮
      this.loginWindow.webContents.on("did-finish-load", () => {
        console.log("页面加载完成，注入按钮");
        this.injectAuthButton();
      });

      // 定期检查登录状态（用于调试）
      const checkInterval = setInterval(async () => {
        if (this.isResolved) {
          clearInterval(checkInterval);
          return;
        }

        if (this.loginWindow && !this.loginWindow.isDestroyed()) {
          const cookies = await this.extractAllCookies(loginSession);
          console.log("当前 cookies 数量:", cookies.length);
          const hasUin = cookies.some((c) => c.name === "uin" || c.name === "login_uin");
          const hasSkey = cookies.some((c) => c.name.includes("skey"));
          console.log("hasUin:", hasUin, "hasSkey:", hasSkey);
        } else {
          clearInterval(checkInterval);
        }
      }, 3000);

      // 窗口关闭时清理
      this.loginWindow.on("closed", () => {
        clearInterval(checkInterval);
        this.extractAuthCallback = null;
        this.loginWindow = null;
        // 如果还没有 resolve，说明用户手动关闭了窗口
        safeResolve({ success: false, message: "用户取消登录" });
      });
    });
  }

  // 检查登录状态（只检测，不提取）
  private async checkLoginStatus(loginSession: Electron.Session): Promise<void> {
    if (this.loginDetected) return;

    try {
      const cookies = await this.extractAllCookies(loginSession);

      // 检查是否有登录相关的 cookie
      const hasUin = cookies.some((c) => c.name === "uin" || c.name === "login_uin");
      const hasSkey = cookies.some((c) => c.name.includes("skey"));

      if (hasUin && hasSkey && cookies.length > 5) {
        console.log("检测到登录 cookies，数量:", cookies.length);
        this.loginDetected = true;

        // 注入提示和按钮，等待用户手动点击
        this.injectAuthButton();
      }
    } catch (error) {
      console.error("检查登录状态失败:", error);
    }
  }

  // 提取所有 cookies
  private async extractAllCookies(loginSession: Electron.Session): Promise<Cookie[]> {
    // 获取腾讯云域名下的所有 cookies
    const cookies = await loginSession.cookies.get({
      domain: TENCENT_DOMAIN,
    });

    // 也获取不带点前缀的域名 cookies
    const cookies2 = await loginSession.cookies.get({
      domain: "cloud.tencent.com",
    });

    // 去重合并
    const cookieMap = new Map<string, Cookie>();
    [...cookies, ...cookies2].forEach((c) => {
      cookieMap.set(`${c.name}@${c.domain}`, c);
    });

    return Array.from(cookieMap.values());
  }

  // 注入"获取鉴权"按钮和关闭按钮
  private injectAuthButton(): void {
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    const script = `
      (function() {
        // 防止重复注入
        if (document.getElementById('penbridge-auth-banner')) return;

        // 创建顶部横幅
        const banner = document.createElement('div');
        banner.id = 'penbridge-auth-banner';
        banner.style.cssText = \`
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 2147483647 !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          padding: 12px 20px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 16px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2) !important;
          height: auto !important;
          min-height: 48px !important;
        \`;

        // 提示文字
        const text = document.createElement('span');
        text.textContent = '请先完成登录，然后点击「获取鉴权」按钮';
        text.id = 'penbridge-auth-text';
        text.style.cssText = 'font-size: 14px !important; font-weight: 500 !important; color: white !important;';

        // 按钮容器
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex !important; gap: 10px !important;';

        // 获取鉴权按钮
        const authBtn = document.createElement('button');
        authBtn.textContent = '🔐 获取鉴权';
        authBtn.style.cssText = \`
          background: white !important;
          color: #667eea !important;
          border: none !important;
          padding: 8px 20px !important;
          border-radius: 20px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.2s !important;
        \`;
        authBtn.onmouseover = function() {
          this.style.transform = 'scale(1.05)';
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
        cancelBtn.textContent = '✕ 取消';
        cancelBtn.style.cssText = \`
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
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

        // 添加 padding 防止内容被遮挡
        document.body.style.paddingTop = '52px';
      })();
    `;

    this.loginWindow.webContents.executeJavaScript(script).catch((err) => {
      console.error("注入脚本失败:", err);
    });
  }

  // 设置动作轮询
  private setupActionPolling(): void {
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    // 轮询检查页面中的动作变量
    const pollInterval = setInterval(async () => {
      if (!this.loginWindow || this.loginWindow.isDestroyed()) {
        clearInterval(pollInterval);
        return;
      }

      try {
        const action = await this.loginWindow.webContents.executeJavaScript(`
          (function() {
            const action = window.__PENBRIDGE_ACTION__;
            if (action) {
              window.__PENBRIDGE_ACTION__ = null;
            }
            return action;
          })();
        `);

        if (action === "EXTRACT_AUTH") {
          console.log("检测到获取鉴权动作");
          if (this.extractAuthCallback) {
            this.extractAuthCallback();
          }
          clearInterval(pollInterval);
        } else if (action === "CANCEL_AUTH") {
          console.log("检测到取消动作");
          if (this.loginWindow && !this.loginWindow.isDestroyed()) {
            this.loginWindow.close();
          }
          clearInterval(pollInterval);
        }
      } catch {
        // 页面可能正在导航，忽略错误
      }
    }, 200);
  }

  // 注入消息提示
  private injectMessage(message: string, type: "success" | "error" | "info"): void {
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    const colorMap = {
      success: "#10b981",
      error: "#ef4444",
      info: "#3b82f6",
    };

    const script = `
      (function() {
        // 移除旧消息
        const old = document.getElementById('penbridge-message');
        if (old) old.remove();

        const msg = document.createElement('div');
        msg.id = 'penbridge-message';
        msg.textContent = '${message}';
        msg.style.cssText = \`
          position: fixed;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999999;
          background: ${colorMap[type]};
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          animation: fadeIn 0.3s ease;
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

    this.loginWindow.webContents.executeJavaScript(script).catch(() => {});
  }

  // 登出
  async logout(): Promise<{ success: boolean }> {
    // 清除存储的信息
    this.store.delete("cookies");
    this.store.delete("userInfo");

    // 清除 session 中的 cookies
    const loginSession = session.fromPartition("persist:tencent-login");
    await loginSession.clearStorageData({
      storages: ["cookies"],
    });

    return { success: true };
  }
}
