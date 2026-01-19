import { Cloud, CloudOff, AlertCircle, Loader2, Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNetworkStatus } from "@/hooks/use-network-status";

type SyncStatus = "synced" | "pending" | "syncing" | "conflict" | "error";

interface SyncStatusIndicatorProps {
  syncStatus: SyncStatus;
  errorMessage?: string;
}

export function SyncStatusIndicator({ syncStatus, errorMessage }: SyncStatusIndicatorProps) {
  const isOnline = useNetworkStatus();

  if (!isOnline) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-yellow-500 cursor-default">
              <CloudOff className="h-4 w-4" />
              <span className="text-xs">离线</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>离线模式 - 修改将在网络恢复后同步</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const statusConfig: Record<SyncStatus, { icon: React.ReactNode; text: string; className: string; tooltip: string }> = {
    synced: {
      icon: <Check className="h-3.5 w-3.5" />,
      text: "已同步",
      className: "text-green-500",
      tooltip: "所有更改已同步到云端",
    },
    pending: {
      icon: <Cloud className="h-3.5 w-3.5" />,
      text: "待同步",
      className: "text-blue-500",
      tooltip: "有待同步的更改",
    },
    syncing: {
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
      text: "同步中",
      className: "text-blue-500",
      tooltip: "正在同步到云端...",
    },
    conflict: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: "冲突",
      className: "text-amber-500",
      tooltip: "检测到版本冲突，请解决",
    },
    error: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      text: "失败",
      className: "text-red-500",
      tooltip: errorMessage || "同步失败",
    },
  };

  const config = statusConfig[syncStatus];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 cursor-default ${config.className}`}>
            {config.icon}
            <span className="text-xs">{config.text}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
