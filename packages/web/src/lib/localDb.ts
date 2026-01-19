import Dexie, { type Table } from "dexie";

export type SyncStatus = "synced" | "pending" | "syncing" | "conflict" | "error";

export interface LocalArticle {
  id?: number;
  clientId: string;
  title: string;
  content: string;
  summary?: string;
  tags?: string[];
  folderId?: number;
  status: string;
  localVersion: number;
  remoteVersion?: number;
  contentHash?: string;
  localUpdatedAt: Date;
  serverUpdatedAt?: Date;
  syncStatus: SyncStatus;
  syncError?: string;
  hasConflict: boolean;
  conflictRemoteContent?: string;
  conflictDetectedAt?: Date;
}

export interface LocalFolder {
  id?: number;
  clientId: string;
  name: string;
  parentId?: number;
  order: number;
  syncStatus: SyncStatus;
}

export interface SyncQueueItem {
  id?: number;
  entityType: "article" | "folder";
  entityClientId: string;
  entityId?: number;
  action: "create" | "update" | "delete";
  payload: string;
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

class LocalDatabase extends Dexie {
  articles!: Table<LocalArticle>;
  folders!: Table<LocalFolder>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super("PenBridgeLocal");

    this.version(1).stores({
      articles: "++id, clientId, folderId, syncStatus, localUpdatedAt",
      folders: "++id, clientId, parentId, syncStatus",
      syncQueue: "++id, entityType, entityClientId, createdAt",
    });
  }
}

export const localDb = new LocalDatabase();

export async function clearLocalDatabase(): Promise<void> {
  await localDb.articles.clear();
  await localDb.folders.clear();
  await localDb.syncQueue.clear();
}

export async function getLocalArticleByServerId(
  serverId: number
): Promise<LocalArticle | undefined> {
  return localDb.articles.where("id").equals(serverId).first();
}

export async function getLocalArticleByClientId(
  clientId: string
): Promise<LocalArticle | undefined> {
  return localDb.articles.where("clientId").equals(clientId).first();
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  return localDb.syncQueue.orderBy("createdAt").toArray();
}

export async function getSyncQueueCount(): Promise<number> {
  return localDb.syncQueue.count();
}

export async function getArticlesBySyncStatus(
  status: SyncStatus
): Promise<LocalArticle[]> {
  return localDb.articles.where("syncStatus").equals(status).toArray();
}
