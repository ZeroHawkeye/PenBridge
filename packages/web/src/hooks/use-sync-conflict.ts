import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

interface ConflictState {
  hasConflict: boolean;
  remoteContent?: string;
  remoteUpdatedAt?: Date;
  syncStatus: string;
  dismissed: boolean;
}

export function useSyncConflict(articleId: number | undefined) {
  const [conflictState, setConflictState] = useState<ConflictState>({
    hasConflict: false,
    syncStatus: "synced",
    dismissed: false,
  });

  const { data, refetch } = trpc.sync.checkConflict.useQuery(
    { articleId: articleId! },
    {
      enabled: !!articleId && !conflictState.dismissed,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    }
  );

  const resolveConflictMutation = trpc.sync.resolveConflict.useMutation({
    onSuccess: () => {
      message.success("冲突已解决");
      refetch();
    },
    onError: (error: Error) => {
      message.error(`解决冲突失败: ${error.message}`);
    },
  });

  useEffect(() => {
    if (data?.hasConflict && !conflictState.dismissed) {
      setConflictState({
        hasConflict: true,
        remoteContent: data.remoteContent,
        remoteUpdatedAt: data.remoteUpdatedAt ? new Date(data.remoteUpdatedAt) : undefined,
        syncStatus: data.syncStatus,
        dismissed: false,
      });
    } else if (data && !data.hasConflict) {
      setConflictState((prev) => ({
        ...prev,
        hasConflict: false,
        syncStatus: data.syncStatus,
      }));
    }
  }, [data, conflictState.dismissed]);

  const dismissConflict = useCallback(() => {
    setConflictState((prev) => ({ ...prev, dismissed: true }));
  }, []);

  const useLocalVersion = useCallback(async () => {
    if (!articleId) return;
    await resolveConflictMutation.mutateAsync({
      articleId,
      resolution: "local",
    });
    setConflictState({
      hasConflict: false,
      syncStatus: "pending",
      dismissed: false,
    });
  }, [articleId, resolveConflictMutation]);

  const useRemoteVersion = useCallback(async () => {
    if (!articleId) return;
    await resolveConflictMutation.mutateAsync({
      articleId,
      resolution: "remote",
    });
    setConflictState({
      hasConflict: false,
      syncStatus: "synced",
      dismissed: false,
    });
    return true;
  }, [articleId, resolveConflictMutation]);

  const resetDismissed = useCallback(() => {
    setConflictState((prev) => ({ ...prev, dismissed: false }));
  }, []);

  return {
    ...conflictState,
    isResolving: resolveConflictMutation.isPending,
    dismissConflict,
    useLocalVersion,
    useRemoteVersion,
    resetDismissed,
    refetch,
  };
}
