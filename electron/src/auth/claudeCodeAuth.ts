import { shell, ipcMain } from "electron";

export function registerClaudeCodeAuthHandlers() {
  ipcMain.handle(
    "claudeCodeAuth:openAuthorizePage",
    async (_event, authorizeUrl: string) => {
      try {
        await shell.openExternal(authorizeUrl);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : "打开授权页面失败",
        };
      }
    }
  );
}
