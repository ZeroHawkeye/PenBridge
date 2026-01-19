import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/utils/trpc";
import { syncManager } from "@/lib/syncManager";
import { localDb, type LocalArticle, type SyncStatus } from "@/lib/localDb";
import { simpleHash } from "@/utils/contentHash";

interface UseSyncManagerOptions {
  onConflictDetected?: () => void;
}

export function useSyncManager(options: UseSyncManagerOptions = {}) {
  const { onConflictDetected } = options;
  const syncInProgressRef = useRef(false);

  const updateMutation = trpc.article.update.useMutation();
  const syncUpdateMutation = trpc.article.syncUpdate.useMutation();

  const syncToServer = useCallback(
    async (article: LocalArticle): Promise<boolean> => {
      if (!article.id || syncInProgressRef.current) return false;

      syncInProgressRef.current = true;

      try {
        await localDb.articles
          .where("clientId")
          .equals(article.clientId)
          .modify({ syncStatus: "syncing" as SyncStatus });

        const result = await syncUpdateMutation.mutateAsync({
          id: article.id,
          title: article.title || "无标题",
          content: article.content || " ",
          summary: article.summary,
          clientId: article.clientId,
          contentHash: article.contentHash || simpleHash(article.content || ""),
          lastModifiedBy: syncManager.getDeviceId(),
          localVersion: article.localVersion,
          baseVersion: article.remoteVersion,
        });

        if (result.conflict) {
          await localDb.articles
            .where("clientId")
            .equals(article.clientId)
            .modify({
              syncStatus: "conflict" as SyncStatus,
              hasConflict: true,
              remoteVersion: result.serverVersion,
            });

          onConflictDetected?.();
          return false;
        }

        await localDb.articles
          .where("clientId")
          .equals(article.clientId)
          .modify({
            syncStatus: "synced" as SyncStatus,
            serverUpdatedAt: new Date(),
            remoteVersion: article.localVersion,
          });

        await localDb.syncQueue
          .where("entityClientId")
          .equals(article.clientId)
          .delete();

        return true;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "同步失败";
        await localDb.articles
          .where("clientId")
          .equals(article.clientId)
          .modify({
            syncStatus: "error" as SyncStatus,
            syncError: errorMessage,
          });
        console.error("同步到服务器失败:", error);
        return false;
      } finally {
        syncInProgressRef.current = false;
      }
    },
    [syncUpdateMutation, onConflictDetected]
  );

  const processSyncQueue = useCallback(async () => {
    if (!syncManager.isNetworkOnline()) return;

    const pendingItems = await localDb.syncQueue
      .orderBy("createdAt")
      .limit(10)
      .toArray();

    for (const item of pendingItems) {
      if (item.entityType !== "article" || !item.entityId) continue;

      const localArticle = await localDb.articles
        .where("clientId")
        .equals(item.entityClientId)
        .first();

      if (localArticle) {
        await syncToServer(localArticle);
      }
    }
  }, [syncToServer]);

  const saveAndSync = useCallback(
    async (data: {
      id: number;
      title: string;
      content: string;
      summary?: string;
      clientId?: string;
    }) => {
      const clientId = data.clientId || syncManager.getDeviceId() + "-" + Date.now();
      const contentHash = simpleHash(data.content || "");

      const existingLocal = await localDb.articles.where("id").equals(data.id).first();
      const localVersion = (existingLocal?.localVersion || 0) + 1;

      const localArticle: LocalArticle = {
        id: data.id,
        clientId,
        title: data.title,
        content: data.content,
        summary: data.summary,
        status: "draft",
        localVersion,
        remoteVersion: existingLocal?.remoteVersion,
        contentHash,
        localUpdatedAt: new Date(),
        serverUpdatedAt: existingLocal?.serverUpdatedAt,
        syncStatus: "pending",
        hasConflict: false,
      };

      if (existingLocal) {
        await localDb.articles.update(data.id, {
          clientId: localArticle.clientId,
          title: localArticle.title,
          content: localArticle.content,
          summary: localArticle.summary,
          localVersion: localArticle.localVersion,
          contentHash: localArticle.contentHash,
          localUpdatedAt: localArticle.localUpdatedAt,
          syncStatus: localArticle.syncStatus,
        });
      } else {
        await localDb.articles.add(localArticle);
      }

      if (syncManager.isNetworkOnline()) {
        const success = await syncToServer(localArticle);
        if (!success) {
          await localDb.syncQueue.add({
            entityType: "article",
            entityClientId: clientId,
            entityId: data.id,
            action: "update",
            payload: JSON.stringify(localArticle),
            createdAt: new Date(),
            retryCount: 0,
          });
        }
      } else {
        await localDb.syncQueue.add({
          entityType: "article",
          entityClientId: clientId,
          entityId: data.id,
          action: "update",
          payload: JSON.stringify(localArticle),
          createdAt: new Date(),
          retryCount: 0,
        });
      }

      return localArticle;
    },
    [syncToServer]
  );

  const quickSave = useCallback(
    async (data: { id: number; title: string; content: string; summary?: string }) => {
      try {
        await updateMutation.mutateAsync({
          id: data.id,
          title: data.title || "无标题",
          content: data.content || " ",
          summary: data.summary,
          clientId: syncManager.getDeviceId() + "-" + Date.now(),
          contentHash: simpleHash(data.content || ""),
          lastModifiedBy: syncManager.getDeviceId(),
        });
        return true;
      } catch (error) {
        console.error("快速保存失败:", error);
        return false;
      }
    },
    [updateMutation]
  );

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((event) => {
      if (event.type === "online") {
        processSyncQueue();
      }
    });

    return unsubscribe;
  }, [processSyncQueue]);

  return {
    saveAndSync,
    quickSave,
    processSyncQueue,
    syncToServer,
    isOnline: syncManager.isNetworkOnline(),
    isSyncing: syncInProgressRef.current,
    deviceId: syncManager.getDeviceId(),
  };
}
