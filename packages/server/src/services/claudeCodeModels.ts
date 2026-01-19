import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const MODELS_API_URL = "https://models.dev/api.json";
const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "claude-code-models.json");
const HASH_FILE = path.join(CACHE_DIR, "claude-code-models.hash");

export interface ClaudeCodeModel {
  id: string;
  name: string;
  vision: boolean;
  functionCalling: boolean;
  reasoning: boolean;
  contextLength: number;
  maxOutput: number;
}

interface ApiModel {
  id: string;
  name: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  limit?: {
    context?: number;
    output?: number;
  };
}

interface ApiProvider {
  id: string;
  name: string;
  models: Record<string, ApiModel>;
}

interface ModelsApiResponse {
  anthropic?: ApiProvider;
  [key: string]: ApiProvider | undefined;
}

let cachedModels: ClaudeCodeModel[] | null = null;
let isUpdating = false;

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function computeHash(data: string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function transformApiModels(apiModels: Record<string, ApiModel>): ClaudeCodeModel[] {
  const models: ClaudeCodeModel[] = [];
  
  for (const [, model] of Object.entries(apiModels)) {
    models.push({
      id: model.id,
      name: model.name,
      vision: model.attachment ?? false,
      functionCalling: model.tool_call ?? true,
      reasoning: model.reasoning ?? false,
      contextLength: model.limit?.context ?? 200000,
      maxOutput: model.limit?.output ?? 8192,
    });
  }
  
  return models.sort((a, b) => {
    const aIsLatest = a.id.includes("latest") || a.name.includes("latest");
    const bIsLatest = b.id.includes("latest") || b.name.includes("latest");
    if (aIsLatest && !bIsLatest) return -1;
    if (!aIsLatest && bIsLatest) return 1;
    
    const familyOrder = ["opus", "sonnet", "haiku"];
    const aFamily = familyOrder.findIndex(f => a.id.toLowerCase().includes(f));
    const bFamily = familyOrder.findIndex(f => b.id.toLowerCase().includes(f));
    if (aFamily !== bFamily) return aFamily - bFamily;
    
    return b.id.localeCompare(a.id);
  });
}

function loadCachedModels(): ClaudeCodeModel[] | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("[ClaudeCodeModels] 加载缓存失败:", error);
  }
  return null;
}

function saveCacheModels(models: ClaudeCodeModel[], hash: string): void {
  try {
    ensureCacheDir();
    fs.writeFileSync(CACHE_FILE, JSON.stringify(models, null, 2));
    fs.writeFileSync(HASH_FILE, hash);
    console.log("[ClaudeCodeModels] 缓存已保存");
  } catch (error) {
    console.error("[ClaudeCodeModels] 保存缓存失败:", error);
  }
}

function loadCachedHash(): string | null {
  try {
    if (fs.existsSync(HASH_FILE)) {
      return fs.readFileSync(HASH_FILE, "utf-8").trim();
    }
  } catch (error) {
    console.debug("[ClaudeCodeModels] 读取缓存哈希失败:", error);
  }
  return null;
}

async function fetchModelsFromApi(): Promise<{ models: ClaudeCodeModel[]; hash: string } | null> {
  try {
    console.log("[ClaudeCodeModels] 从 API 获取模型列表...");
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(MODELS_API_URL, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "PenBridge/1.0",
      },
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const text = await response.text();
    const hash = computeHash(text);
    const data: ModelsApiResponse = JSON.parse(text);
    
    const anthropic = data.anthropic;
    if (!anthropic?.models) {
      throw new Error("API 响应中未找到 Anthropic 模型");
    }
    
    const models = transformApiModels(anthropic.models);
    console.log(`[ClaudeCodeModels] 获取到 ${models.length} 个模型`);
    
    return { models, hash };
  } catch (error) {
    console.error("[ClaudeCodeModels] 从 API 获取失败:", error);
    return null;
  }
}

async function checkAndUpdateInBackground(): Promise<void> {
  if (isUpdating) return;
  isUpdating = true;
  
  try {
    const result = await fetchModelsFromApi();
    if (!result) return;
    
    const cachedHash = loadCachedHash();
    if (cachedHash !== result.hash) {
      console.log("[ClaudeCodeModels] 检测到更新，刷新缓存");
      saveCacheModels(result.models, result.hash);
      cachedModels = result.models;
    } else {
      console.log("[ClaudeCodeModels] 模型列表无变化");
    }
  } finally {
    isUpdating = false;
  }
}

export async function getClaudeCodeModels(): Promise<ClaudeCodeModel[]> {
  if (cachedModels) {
    checkAndUpdateInBackground();
    return cachedModels;
  }
  
  const diskCache = loadCachedModels();
  if (diskCache && diskCache.length > 0) {
    cachedModels = diskCache;
    checkAndUpdateInBackground();
    return cachedModels;
  }
  
  const result = await fetchModelsFromApi();
  if (result) {
    saveCacheModels(result.models, result.hash);
    cachedModels = result.models;
    return cachedModels;
  }
  
  return getDefaultModels();
}

export function getDefaultModels(): ClaudeCodeModel[] {
  return [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", vision: true, functionCalling: true, reasoning: true, contextLength: 200000, maxOutput: 16000 },
    { id: "claude-3-7-sonnet-20250219", name: "Claude 3.7 Sonnet", vision: true, functionCalling: true, reasoning: false, contextLength: 200000, maxOutput: 8192 },
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", vision: true, functionCalling: true, reasoning: false, contextLength: 200000, maxOutput: 8192 },
    { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", vision: true, functionCalling: true, reasoning: false, contextLength: 200000, maxOutput: 8192 },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus", vision: true, functionCalling: true, reasoning: false, contextLength: 200000, maxOutput: 4096 },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", vision: true, functionCalling: true, reasoning: false, contextLength: 200000, maxOutput: 4096 },
  ];
}

export async function refreshModelsCache(): Promise<ClaudeCodeModel[]> {
  const result = await fetchModelsFromApi();
  if (result) {
    saveCacheModels(result.models, result.hash);
    cachedModels = result.models;
    return cachedModels;
  }
  return cachedModels || getDefaultModels();
}
