import { v4 as uuidv4 } from "uuid";
import { localDb, type LocalArticle, type SyncQueueItem, type SyncStatus } from "./localDb";
import { simpleHash } from "@/utils/contentHash";
import { message } from "antd";

type SyncEventType = "online" | "offline" | "syncStart" | "syncComplete" | "syncError" | "conflictDetected";
type SyncEventCallback = (event: { type: SyncEventType; data?: unknown }) => void;

const DEVICE_ID_KEY = "pen-bridge-device-id";
const MAX_RETRIES = 3;

class SyncManager {
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncInProgress = false;
  private deviceId: string;
  private listeners: Set<SyncEventCallback> = new Set();
  private retryTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  private getOrCreateDeviceId(): string {
    if (typeof localStorage === "undefined") return uuidv4();
    
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = uuidv4();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  subscribe(callback: SyncEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private emit(type: SyncEventType, data?: unknown) {
    this.listeners.forEach((callback) => callback({ type, data }));
  }

  private handleOnline() {
    this.isOnline = true;
    this.emit("online");
    message.success("网络已恢复，正在同步...");
    this.triggerSync();
  }

  private handleOffline() {
    this.isOnline = false;
    this.emit("offline");
    message.warning("网络已断开，修改将在恢复后同步");
  }

  async saveArticleLocally(article: Partial<LocalArticle>): Promise<LocalArticle> {
    const now = new Date();
    const clientId = article.clientId || uuidv4();
    const content = article.content || "";

    const localArticle: LocalArticle = {
      ...article,
      clientId,
      localVersion: (article.localVersion || 0) + 1,
      contentHash: simpleHash(content),
      localUpdatedAt: now,
      syncStatus: "pending" as SyncStatus,
      hasConflict: false,
    } as LocalArticle;

    if (article.id) {
      await localDb.articles.update(article.id, {
        clientId: localArticle.clientId,
        title: localArticle.title,
        content: localArticle.content,
        summary: localArticle.summary,
        folderId: localArticle.folderId,
        status: localArticle.status,
        localVersion: localArticle.localVersion,
        contentHash: localArticle.contentHash,
        localUpdatedAt: localArticle.localUpdatedAt,
        syncStatus: localArticle.syncStatus,
        hasConflict: localArticle.hasConflict,
      });
    } else {
      const id = await localDb.articles.add(localArticle);
      localArticle.id = id as number;
    }

    await this.enqueueSync({
      entityType: "article",
      entityClientId: clientId,
      entityId: article.id,
      action: article.id ? "update" : "create",
      payload: JSON.stringify(localArticle),
      createdAt: now,
      retryCount: 0,
    });

    if (this.isOnline) {
      this.triggerSync();
    }

    return localArticle;
  }

  private async enqueueSync(item: Omit<SyncQueueItem, "id">): Promise<void> {
    const existing = await localDb.syncQueue
      .where("entityClientId")
      .equals(item.entityClientId)
      .first();

    if (existing) {
      await localDb.syncQueue.update(existing.id!, {
        ...item,
        retryCount: existing.retryCount,
      });
    } else {
      await localDb.syncQueue.add(item as SyncQueueItem);
    }
  }

  async triggerSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) return;
    this.syncInProgress = true;
    this.emit("syncStart");

    try {
      const pendingItems = await localDb.syncQueue
        .orderBy("createdAt")
        .limit(10)
        .toArray();

      for (const item of pendingItems) {
        await this.syncItem(item);
      }

      this.emit("syncComplete");
    } catch (error) {
      console.error("Sync failed:", error);
      this.emit("syncError", error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    if (!item.entityId) {
      await localDb.syncQueue.delete(item.id!);
      return;
    }

    await localDb.articles
      .where("clientId")
      .equals(item.entityClientId)
      .modify({ syncStatus: "syncing" as SyncStatus });

    try {
      await localDb.articles
        .where("clientId")
        .equals(item.entityClientId)
        .modify({
          syncStatus: "synced" as SyncStatus,
          serverUpdatedAt: new Date(),
        });

      await localDb.syncQueue.delete(item.id!);

      const timeoutId = this.retryTimeouts.get(item.entityClientId);
      if (timeoutId) {
        clearTimeout(timeoutId);
        this.retryTimeouts.delete(item.entityClientId);
      }
    } catch (error: unknown) {
      await this.handleSyncError(item, error as Error);
    }
  }

  private async handleSyncError(item: SyncQueueItem, error: Error): Promise<void> {
    if (item.retryCount >= MAX_RETRIES) {
      await localDb.articles
        .where("clientId")
        .equals(item.entityClientId)
        .modify({
          syncStatus: "error" as SyncStatus,
          syncError: error.message,
        });

      await localDb.syncQueue.delete(item.id!);
      message.error(`同步失败: ${error.message}`);
      return;
    }

    await localDb.syncQueue.update(item.id!, {
      retryCount: item.retryCount + 1,
      lastError: error.message,
    });

    await localDb.articles
      .where("clientId")
      .equals(item.entityClientId)
      .modify({ syncStatus: "pending" as SyncStatus });

    const delay = Math.pow(2, item.retryCount) * 1000;
    const timeoutId = setTimeout(() => {
      this.retryTimeouts.delete(item.entityClientId);
      this.triggerSync();
    }, delay);

    this.retryTimeouts.set(item.entityClientId, timeoutId);
  }

  async updateArticleSyncStatus(
    clientId: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    const updateData: Partial<LocalArticle> = { syncStatus: status };
    if (error) {
      updateData.syncError = error;
    }
    await localDb.articles.where("clientId").equals(clientId).modify(updateData);
  }

  async getLocalArticle(id: number): Promise<LocalArticle | undefined> {
    return localDb.articles.where("id").equals(id).first();
  }

  async getPendingCount(): Promise<number> {
    return localDb.syncQueue.count();
  }

  async getErrorCount(): Promise<number> {
    return localDb.articles.where("syncStatus").equals("error").count();
  }

  destroy(): void {
    this.retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.listeners.clear();
  }
}

export const syncManager = new SyncManager();
