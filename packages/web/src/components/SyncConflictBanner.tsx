import { AlertTriangle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

interface SyncConflictBannerProps {
  remoteUpdatedAt?: Date;
  isResolving: boolean;
  onViewDiff?: () => void;
  onUseLocal: () => void;
  onUseRemote: () => void;
  onDismiss: () => void;
}

export function SyncConflictBanner({
  remoteUpdatedAt,
  isResolving,
  onViewDiff,
  onUseLocal,
  onUseRemote,
  onDismiss,
}: SyncConflictBannerProps) {
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="text-sm truncate">
          云端有新版本
          {remoteUpdatedAt && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">
              ({dayjs(remoteUpdatedAt).fromNow()})
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onViewDiff && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={onViewDiff}
            disabled={isResolving}
          >
            查看对比
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onUseLocal}
          disabled={isResolving}
        >
          {isResolving ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          保留本地
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onUseRemote}
          disabled={isResolving}
        >
          使用云端
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onDismiss}
          disabled={isResolving}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
