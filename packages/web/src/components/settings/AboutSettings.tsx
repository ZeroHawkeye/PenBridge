// 关于设置组件

import { useEffect, useState } from "react";
import {
  CheckCircle,
  Download,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { isElectron } from "./utils";
import type { UpdateStatusType } from "./types";

// GitHub Release 页面地址
const GITHUB_RELEASES_URL = "https://github.com/ZeroHawkeye/PenBridge/releases";
const GITHUB_REPO_URL = "https://github.com/ZeroHawkeye/PenBridge";

// 关于组件
export function AboutSettings() {
  // 使用构建时注入的版本号作为默认值，Electron 环境会用 app.getVersion() 覆盖
  const [currentVersion, setCurrentVersion] = useState<string>(__APP_VERSION__);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusType | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // 获取当前版本和更新状态（仅 Electron 环境）
  useEffect(() => {
    if (!isElectron()) return;

    // Electron 环境：获取 app.getVersion() 的版本号（与构建时的版本号应该一致）
    window.electronAPI!.updater.getVersion().then(setCurrentVersion);

    // 获取当前更新状态
    window.electronAPI!.updater.getStatus().then(setUpdateStatus);

    // 监听更新状态变化
    const unsubscribe = window.electronAPI!.updater.onStatusChange((status) => {
      setUpdateStatus(status);
      if (!status.checking) {
        setIsCheckingUpdate(false);
      }
    });

    return unsubscribe;
  }, []);

  // 检查更新
  const handleCheckUpdate = async () => {
    if (!isElectron()) return;
    setIsCheckingUpdate(true);
    try {
      await window.electronAPI!.updater.check();
    } catch (error) {
      console.error("检查更新失败:", error);
      setIsCheckingUpdate(false);
    }
  };

  // 下载更新
  const handleDownloadUpdate = async () => {
    if (!isElectron()) return;
    await window.electronAPI!.updater.download();
  };

  // 安装更新
  const handleInstallUpdate = () => {
    if (!isElectron()) return;
    window.electronAPI!.updater.install();
  };

  // 打开 GitHub Releases
  const handleOpenReleases = () => {
    if (isElectron()) {
      window.electronAPI!.shell.openExternal(GITHUB_RELEASES_URL);
    } else {
      window.open(GITHUB_RELEASES_URL, "_blank");
    }
  };

  // 打开 GitHub 仓库
  const handleOpenRepo = () => {
    if (isElectron()) {
      window.electronAPI!.shell.openExternal(GITHUB_REPO_URL);
    } else {
      window.open(GITHUB_REPO_URL, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">关于</h2>
        <p className="text-sm text-muted-foreground">
          应用信息和功能说明
        </p>
      </div>

      {/* 版本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            PenBridge
          </CardTitle>
          <CardDescription>
            多平台文章管理与发布工具
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前版本 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">当前版本</p>
              <p className="text-2xl font-bold text-primary">{currentVersion}</p>
            </div>
            {isElectron() && (
              <Button
                variant="outline"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || updateStatus?.downloading}
              >
                {isCheckingUpdate || updateStatus?.checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    检查中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    检查更新
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 更新状态显示（仅 Electron） */}
          {isElectron() && updateStatus && (
            <>
              {/* 有新版本可用 */}
              {updateStatus.available && !updateStatus.downloaded && !updateStatus.downloading && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        <span className="font-medium">发现新版本</span>
                        <Badge className="bg-primary">{updateStatus.version}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        新版本已发布，点击下载更新
                      </p>
                    </div>
                    <Button onClick={handleDownloadUpdate}>
                      <Download className="h-4 w-4 mr-2" />
                      下载更新
                    </Button>
                  </div>
                </div>
              )}

              {/* 下载中 */}
              {updateStatus.downloading && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">正在下载更新...</span>
                    <span className="text-sm text-muted-foreground">
                      {updateStatus.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${updateStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 下载完成，等待安装 */}
              {updateStatus.downloaded && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-700 dark:text-green-400">
                        更新已下载完成
                      </span>
                    </div>
                    <Button onClick={handleInstallUpdate} className="bg-green-600 hover:bg-green-700">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      立即重启更新
                    </Button>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    点击"立即重启更新"将关闭应用并安装新版本
                  </p>
                </div>
              )}

              {/* 错误状态 */}
              {updateStatus.error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-700 dark:text-red-400">
                      更新检查失败
                    </span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {updateStatus.error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleOpenReleases}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    前往 GitHub 手动下载
                  </Button>
                </div>
              )}

              {/* 已是最新版本 */}
              {!updateStatus.available && !updateStatus.checking && !updateStatus.error && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  当前已是最新版本
                </div>
              )}
            </>
          )}

          {/* Web 端提示 */}
          {!isElectron() && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">您正在使用 Web 版本</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                推荐使用桌面客户端以获得完整功能体验，包括自动更新、平台登录授权等功能。
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenReleases}>
                <Download className="h-4 w-4 mr-2" />
                下载桌面客户端
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 功能介绍 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">功能介绍</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Markdown 文章编辑与管理</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>多平台授权登录（腾讯云社区、掘金等）</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>一键发布到多个平台</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>定时发布功能</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>邮件通知功能</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>AI 写作辅助</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>多用户管理</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 开源信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">开源项目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            PenBridge 是一个开源项目，欢迎贡献代码和提交问题反馈。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenRepo}>
              <ExternalLink className="h-4 w-4 mr-2" />
              GitHub 仓库
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenReleases}>
              <Download className="h-4 w-4 mr-2" />
              版本发布
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
