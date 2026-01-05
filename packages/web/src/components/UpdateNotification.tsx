import { useState, useEffect } from "react";
import { Download, X, RefreshCw, ExternalLink, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { UpdateStatus } from "@/types/electron.d";

// 检测是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};

// GitHub Release 页面地址
const GITHUB_RELEASES_URL = "https://github.com/zerx-lab/PenBridge/releases";

// 更新通知组件
export function UpdateNotification() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    if (!isElectron()) return;

    // 获取当前版本
    window.electronAPI!.updater.getVersion().then(setCurrentVersion);

    // 获取初始状态
    window.electronAPI!.updater.getStatus().then(setStatus);

    // 监听状态变化
    const unsubscribe = window.electronAPI!.updater.onStatusChange((newStatus) => {
      setStatus(newStatus);
      // 如果有新版本可用，重置 dismissed 状态
      if (newStatus.available && !status?.available) {
        setDismissed(false);
      }
    });

    return unsubscribe;
  }, []);

  // 不在 Electron 环境或已关闭通知或无更新可用
  if (!isElectron() || dismissed || !status?.available) {
    return null;
  }

  const handleDownload = async () => {
    if (isElectron()) {
      await window.electronAPI!.updater.download();
    }
  };

  const handleInstall = () => {
    if (isElectron()) {
      window.electronAPI!.updater.install();
    }
  };

  const handleOpenReleases = () => {
    if (isElectron()) {
      window.electronAPI!.shell.openExternal(GITHUB_RELEASES_URL);
    } else {
      window.open(GITHUB_RELEASES_URL, "_blank");
    }
  };

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg",
        "animate-in slide-in-from-bottom-4 fade-in duration-300"
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          {status.downloaded ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : status.error ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <Download className="h-5 w-5 text-primary" />
          )}
          <span className="font-medium">
            {status.downloaded ? "更新已就绪" : status.error ? "更新失败" : "发现新版本"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 内容 */}
      <div className="p-3 space-y-3">
        {/* 版本信息 */}
        <div className="text-sm">
          <span className="text-muted-foreground">当前版本: </span>
          <span>{currentVersion}</span>
          {status.version && (
            <>
              <span className="text-muted-foreground"> → </span>
              <span className="font-medium text-primary">{status.version}</span>
            </>
          )}
        </div>

        {/* 错误信息 */}
        {status.error && (
          <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
            {status.error}
          </div>
        )}

        {/* 下载进度 */}
        {status.downloading && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">下载进度</span>
              <span>{status.progress.toFixed(1)}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          {status.downloaded ? (
            // 下载完成，显示安装按钮
            <Button className="flex-1" onClick={handleInstall}>
              <RefreshCw className="h-4 w-4 mr-2" />
              立即重启更新
            </Button>
          ) : status.downloading ? (
            // 下载中
            <Button className="flex-1" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              下载中...
            </Button>
          ) : status.error ? (
            // 出错，允许重试或手动下载
            <>
              <Button variant="outline" className="flex-1" onClick={handleDownload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleOpenReleases}>
                <ExternalLink className="h-4 w-4 mr-2" />
                手动下载
              </Button>
            </>
          ) : (
            // 有更新可用
            <>
              <Button className="flex-1" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                下载更新
              </Button>
              <Button variant="outline" size="icon" onClick={handleOpenReleases}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Web 端更新提示（仅显示提示，引导用户去 GitHub 下载）
export function WebUpdateBanner({ latestVersion }: { latestVersion?: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !latestVersion) {
    return null;
  }

  const handleOpenReleases = () => {
    window.open(GITHUB_RELEASES_URL, "_blank");
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Download className="h-4 w-4 text-primary" />
          <span>
            新版本 <strong>{latestVersion}</strong> 已发布！
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleOpenReleases}>
            <ExternalLink className="h-3 w-3 mr-1" />
            前往下载
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
