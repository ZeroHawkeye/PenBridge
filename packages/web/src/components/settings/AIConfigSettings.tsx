import { useState } from "react";
import {
  Bot,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";
import { message } from "antd";
import { getAuthToken } from "@/utils/auth";
import { getServerBaseUrl } from "@/utils/serverConfig";

// AI 配置组件
export function AIConfigSettings() {
  const utils = trpc.useContext();
  
  // 获取供应商列表
  const { data: providers, isLoading: providersLoading } = trpc.aiConfig.listProviders.useQuery();
  // 获取模型列表
  const { data: models, isLoading: modelsLoading } = trpc.aiConfig.listModels.useQuery({});

  // 供应商表单状态
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<any>(null);
  const [providerForm, setProviderForm] = useState({
    name: "",
    baseUrl: "",
    apiKey: "",
    apiType: "openai" as "openai" | "zhipu",
  });

  // 模型表单状态
  const [showModelDialog, setShowModelDialog] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  const [modelForm, setModelForm] = useState({
    modelId: "",
    displayName: "",
    isDefault: false,
    // 上下文最大长度（tokens）
    contextLength: undefined as number | undefined,
    parameters: {
      temperature: 0.7,
      maxTokens: 4096,
    },
    // 模型能力配置
    capabilities: {
      thinking: {
        supported: false,
        apiFormat: "standard" as "standard" | "openai",
        // 注意：enabled 和 reasoningEffort 已移至 AI Chat 面板动态选择
        reasoningSummary: "auto" as "auto" | "detailed" | "concise" | "disabled",
      },
      streaming: {
        supported: true,
        enabled: true,
      },
      functionCalling: {
        supported: true,
      },
      vision: {
        supported: false,
      },
      aiLoop: {
        maxLoopCount: 20,
        unlimitedLoop: false,
      },
    },
  });

  // 显示 API Key 状态
  const [showApiKey, setShowApiKey] = useState(false);

  // 测试对话状态
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testingModel, setTestingModel] = useState<any>(null);
  const [testInput, setTestInput] = useState("你好，请简单介绍一下你自己。");
  const [testLoading, setTestLoading] = useState(false);
  const [testStreamContent, setTestStreamContent] = useState("");
  const [testReasoningContent, setTestReasoningContent] = useState(""); // 思维链内容
  const [isReasoning, setIsReasoning] = useState(false); // 是否正在思考
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    streamSupported?: boolean;
    hasReasoning?: boolean; // 是否有思维链
    response?: string | null;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
    duration?: number;
  } | null>(null);

  // 创建供应商
  const createProviderMutation = trpc.aiConfig.createProvider.useMutation({
    onSuccess: () => {
      message.success("供应商创建成功");
      setShowProviderDialog(false);
      resetProviderForm();
      utils.aiConfig.listProviders.invalidate();
    },
    onError: (error: Error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新供应商
  const updateProviderMutation = trpc.aiConfig.updateProvider.useMutation({
    onSuccess: () => {
      message.success("供应商更新成功");
      setShowProviderDialog(false);
      setEditingProvider(null);
      resetProviderForm();
      utils.aiConfig.listProviders.invalidate();
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 删除供应商
  const deleteProviderMutation = trpc.aiConfig.deleteProvider.useMutation({
    onSuccess: () => {
      message.success("供应商已删除");
      utils.aiConfig.listProviders.invalidate();
      utils.aiConfig.listModels.invalidate();
    },
    onError: (error: Error) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 创建模型
  const createModelMutation = trpc.aiConfig.createModel.useMutation({
    onSuccess: () => {
      message.success("模型创建成功");
      setShowModelDialog(false);
      resetModelForm();
      utils.aiConfig.listModels.invalidate();
    },
    onError: (error: Error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  // 更新模型
  const updateModelMutation = trpc.aiConfig.updateModel.useMutation({
    onSuccess: () => {
      message.success("模型更新成功");
      setShowModelDialog(false);
      setEditingModel(null);
      resetModelForm();
      utils.aiConfig.listModels.invalidate();
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 删除模型
  const deleteModelMutation = trpc.aiConfig.deleteModel.useMutation({
    onSuccess: () => {
      message.success("模型已删除");
      utils.aiConfig.listModels.invalidate();
    },
    onError: (error: Error) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 测试连接（不再使用 tRPC mutation）

  const resetProviderForm = () => {
    setProviderForm({ name: "", baseUrl: "", apiKey: "", apiType: "openai" });
    setShowApiKey(false);
  };

  const defaultCapabilities = {
    thinking: {
      supported: false,
      apiFormat: "standard" as "standard" | "openai",
      // 注意：enabled 和 reasoningEffort 已移至 AI Chat 面板动态选择
      reasoningSummary: "auto" as "auto" | "detailed" | "concise" | "disabled",
    },
    streaming: {
      supported: true,
      enabled: true,
    },
    functionCalling: {
      supported: true,  // 默认启用，主流模型都支持工具调用
    },
    vision: {
      supported: false,
    },
    aiLoop: {
      maxLoopCount: 20,
      unlimitedLoop: false,
    },
  };

  const resetModelForm = () => {
    setModelForm({
      modelId: "",
      displayName: "",
      isDefault: false,
      contextLength: undefined,
      parameters: { temperature: 0.7, maxTokens: 4096 },
      capabilities: defaultCapabilities,
    });
    setSelectedProviderId(null);
  };

  const handleEditProvider = (provider: any) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      apiType: provider.apiType || "openai",
    });
    setShowProviderDialog(true);
  };

  const handleEditModel = (model: any) => {
    setEditingModel(model);
    setSelectedProviderId(model.providerId);
    
    // 深度合并 capabilities，确保所有字段都有默认值
    const modelCapabilities = model.capabilities || {};
    const mergedCapabilities = {
      thinking: {
        ...defaultCapabilities.thinking,
        ...(modelCapabilities.thinking || {}),
      },
      streaming: {
        ...defaultCapabilities.streaming,
        ...(modelCapabilities.streaming || {}),
      },
      functionCalling: {
        ...defaultCapabilities.functionCalling,
        ...(modelCapabilities.functionCalling || {}),
      },
      vision: {
        ...defaultCapabilities.vision,
        ...(modelCapabilities.vision || {}),
      },
      aiLoop: {
        ...defaultCapabilities.aiLoop,
        ...(modelCapabilities.aiLoop || {}),
      },
    };
    
    setModelForm({
      modelId: model.modelId,
      displayName: model.displayName,
      isDefault: model.isDefault,
      contextLength: model.contextLength,
      parameters: model.parameters || { temperature: 0.7, maxTokens: 4096 },
      capabilities: mergedCapabilities,
    });
    setShowModelDialog(true);
  };

  const handleSaveProvider = () => {
    if (!providerForm.name.trim()) {
      message.error("请输入供应商名称");
      return;
    }
    if (!providerForm.baseUrl.trim()) {
      message.error("请输入 API 地址");
      return;
    }
    if (!editingProvider && !providerForm.apiKey.trim()) {
      message.error("请输入 API Key");
      return;
    }

    if (editingProvider) {
      updateProviderMutation.mutate({
        id: editingProvider.id,
        ...providerForm,
      });
    } else {
      createProviderMutation.mutate(providerForm);
    }
  };

  const handleSaveModel = () => {
    if (!selectedProviderId) {
      message.error("请选择供应商");
      return;
    }
    if (!modelForm.modelId.trim()) {
      message.error("请输入模型标识");
      return;
    }
    if (!modelForm.displayName.trim()) {
      message.error("请输入显示名称");
      return;
    }
    // 验证工具最大调用次数
    const maxLoopCount = modelForm.capabilities.aiLoop.maxLoopCount;
    if (maxLoopCount < 1 || maxLoopCount > 100) {
      message.error("工具最大调用次数必须在 1-100 之间");
      return;
    }

    if (editingModel) {
      updateModelMutation.mutate({
        id: editingModel.id,
        ...modelForm,
      });
    } else {
      createModelMutation.mutate({
        providerId: selectedProviderId,
        ...modelForm,
      });
    }
  };

  const handleDeleteProvider = (provider: any) => {
    if (confirm(`确定要删除供应商 "${provider.name}" 吗？这将同时删除该供应商下的所有模型配置。`)) {
      deleteProviderMutation.mutate({ id: provider.id });
    }
  };

  const handleDeleteModel = (model: any) => {
    if (confirm(`确定要删除模型 "${model.displayName}" 吗？`)) {
      deleteModelMutation.mutate({ id: model.id });
    }
  };

  const handleOpenTestDialog = (model: any) => {
    setTestingModel(model);
    setTestResult(null);
    setTestStreamContent("");
    setTestInput("你好，请简单介绍一下你自己。");
    setShowTestDialog(true);
  };

  const handleSendTestMessage = async () => {
    if (!testingModel || !testInput.trim()) return;
    
    setTestResult(null);
    setTestStreamContent("");
    setTestReasoningContent("");
    setIsReasoning(false);
    setTestLoading(true);

    try {
      // 获取 token
      const token = getAuthToken();
      if (!token) {
        setTestResult({
          success: false,
          message: "未登录",
        });
        setTestLoading(false);
        return;
      }

      // 获取服务器地址
      const baseUrl = await getServerBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerId: testingModel.providerId,
          modelId: testingModel.modelId,
          message: testInput.trim(),
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      // 检查是否为 SSE 流
      if (contentType.includes("text/event-stream")) {
        // SSE 流式响应
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let fullReasoning = "";
        let currentEvent = ""; // 当前事件类型

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // 解析 SSE 事件类型
            if (trimmedLine.startsWith("event:")) {
              currentEvent = trimmedLine.slice(6).trim();
              continue;
            }
            if (trimmedLine.startsWith("data:")) {
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);

                // 根据事件类型处理
                switch (currentEvent) {
                  case "reasoning_start":
                    // 开始深度思考
                    setIsReasoning(true);
                    break;
                    
                  case "reasoning":
                    // 思维链内容
                    if (data.content) {
                      fullReasoning += data.content;
                      setTestReasoningContent(fullReasoning);
                    }
                    break;
                    
                  case "reasoning_end":
                    // 深度思考结束
                    setIsReasoning(false);
                    break;
                    
                  case "content":
                    // 正常回复内容
                    if (data.content) {
                      fullContent += data.content;
                      setTestStreamContent(fullContent);
                    }
                    break;
                    
                  case "done":
                    // 完成事件
                    setTestResult({
                      success: data.success,
                      message: data.success ? "连接成功" : (data.error || "连接失败"),
                      streamSupported: data.streamSupported,
                      hasReasoning: data.hasReasoning || fullReasoning.length > 0,
                      response: fullContent || null,
                      usage: data.usage,
                      duration: data.duration,
                    });
                    break;
                    
                  case "error":
                    // 错误事件
                    setTestResult({
                      success: false,
                      message: data.error || "未知错误",
                    });
                    break;
                    
                  default:
                    // 兼容旧格式（没有 event 类型的情况）
                    if (data.content) {
                      fullContent += data.content;
                      setTestStreamContent(fullContent);
                    } else if (data.success !== undefined) {
                      setTestResult({
                        success: data.success,
                        message: data.success ? "连接成功" : (data.error || "连接失败"),
                        streamSupported: data.streamSupported,
                        hasReasoning: data.hasReasoning || fullReasoning.length > 0,
                        response: fullContent || null,
                        usage: data.usage,
                        duration: data.duration,
                      });
                    } else if (data.error) {
                      setTestResult({
                        success: false,
                        message: data.error,
                      });
                    }
                }
                
                // 重置事件类型（每个 data 行处理完后重置）
                currentEvent = "";
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
        // 普通 JSON 响应（非流式）
        const data = await response.json();
        
        if (!response.ok) {
          setTestResult({
            success: false,
            message: data.error || "请求失败",
          });
        } else {
          setTestResult({
            success: data.success,
            message: data.success ? (data.message || "连接成功") : (data.error || "连接失败"),
            streamSupported: data.streamSupported,
            response: data.response || null,
            usage: data.usage,
            duration: data.duration,
          });
          if (data.response) {
            setTestStreamContent(data.response);
          }
        }
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "请求失败",
      });
    } finally {
      setTestLoading(false);
    }
  };

  const getProviderName = (providerId: number) => {
    return providers?.find((p: any) => p.id === providerId)?.name || "未知供应商";
  };

  if (providersLoading || modelsLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">AI 配置</h2>
        <p className="text-sm text-muted-foreground">
          配置 AI 供应商和模型，用于智能写作辅助功能
        </p>
      </div>

      {/* 供应商管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 供应商
              </CardTitle>
              <CardDescription>
                配置 OpenAI、Claude、Gemini 等 AI 服务的 API 连接
              </CardDescription>
            </div>
            <Dialog open={showProviderDialog} onOpenChange={(open) => {
              setShowProviderDialog(open);
              if (!open) {
                setEditingProvider(null);
                resetProviderForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  添加供应商
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingProvider ? "编辑供应商" : "添加供应商"}</DialogTitle>
                  <DialogDescription>
                    配置 AI 服务的 API 连接信息
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider-name">供应商名称</Label>
                    <Input
                      id="provider-name"
                      placeholder="如: OpenAI、Claude、通义千问"
                      value={providerForm.name}
                      onChange={(e) => setProviderForm({ ...providerForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-baseUrl">API 地址</Label>
                    <Input
                      id="provider-baseUrl"
                      placeholder="如: https://api.openai.com/v1"
                      value={providerForm.baseUrl}
                      onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      输入 API 的基础地址，不需要包含具体端点
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-apiKey">API Key</Label>
                    <div className="relative">
                      <Input
                        id="provider-apiKey"
                        type={showApiKey ? "text" : "password"}
                        placeholder={editingProvider ? "留空保持不变" : "请输入 API Key"}
                        value={providerForm.apiKey}
                        onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider-apiType">API 类型</Label>
                    <Select
                      value={providerForm.apiType}
                      onValueChange={(value: "openai" | "zhipu") => setProviderForm({ ...providerForm, apiType: value })}
                    >
                      <SelectTrigger id="provider-apiType">
                        <SelectValue placeholder="选择 API 类型" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI 兼容</SelectItem>
                        <SelectItem value="zhipu">智谱 AI</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {providerForm.apiType === "zhipu" 
                        ? "智谱 AI 使用特殊的 tool_stream 格式进行流式工具调用"
                        : "标准 OpenAI 格式，适用于 OpenAI、Claude、通义千问等大多数服务商"}
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveProvider}
                    disabled={createProviderMutation.isLoading || updateProviderMutation.isLoading}
                  >
                    {(createProviderMutation.isLoading || updateProviderMutation.isLoading) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingProvider ? "保存" : "添加"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {providers && providers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>API 地址</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider: any) => (
                  <TableRow key={provider.id}>
                    <TableCell className="font-medium">{provider.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {provider.baseUrl}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {provider.apiType === "zhipu" ? "智谱" : "OpenAI"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {provider.enabled ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          启用
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          禁用
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditProvider(provider)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteProvider(provider)}
                        disabled={deleteProviderMutation.isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂未配置 AI 供应商</p>
              <p className="text-xs mt-1">点击上方按钮添加您的第一个 AI 服务</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 模型管理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                AI 模型
              </CardTitle>
              <CardDescription>
                配置具体的模型，如 GPT-4o、Claude-3-Opus 等
              </CardDescription>
            </div>
            <Dialog open={showModelDialog} onOpenChange={(open) => {
              setShowModelDialog(open);
              if (!open) {
                setEditingModel(null);
                resetModelForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" disabled={!providers || providers.length === 0}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加模型
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>{editingModel ? "编辑模型" : "添加模型"}</DialogTitle>
                  <DialogDescription>
                    配置具体的 AI 模型
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
                  <div className="space-y-2">
                    <Label htmlFor="model-provider">所属供应商</Label>
                    <Select
                      value={selectedProviderId?.toString() || ""}
                      onValueChange={(value) => setSelectedProviderId(parseInt(value))}
                      disabled={!!editingModel}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择供应商" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.map((provider: any) => (
                          <SelectItem key={provider.id} value={provider.id.toString()}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model-id">模型标识</Label>
                    <Input
                      id="model-id"
                      placeholder="如: gpt-4o、claude-3-opus-20240229"
                      value={modelForm.modelId}
                      onChange={(e) => setModelForm({ ...modelForm, modelId: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      请输入 API 调用时使用的模型名称
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model-displayName">显示名称</Label>
                    <Input
                      id="model-displayName"
                      placeholder="如: GPT-4o 最新版"
                      value={modelForm.displayName}
                      onChange={(e) => setModelForm({ ...modelForm, displayName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model-contextLength">上下文最大长度 (Tokens)</Label>
                    <Input
                      id="model-contextLength"
                      type="number"
                      min="1"
                      placeholder="如: 128000 (可选)"
                      value={modelForm.contextLength || ""}
                      onChange={(e) => setModelForm({ 
                        ...modelForm, 
                        contextLength: e.target.value ? parseInt(e.target.value) : undefined 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      模型支持的最大上下文长度，用于在 AI 助手中展示 Token 使用进度
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="model-isDefault" className="flex items-center gap-2">
                      设为默认模型
                    </Label>
                    <Switch
                      id="model-isDefault"
                      checked={modelForm.isDefault}
                      onCheckedChange={(checked) => setModelForm({ ...modelForm, isDefault: checked })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>模型参数</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="model-temperature" className="text-xs text-muted-foreground">
                          Temperature ({modelForm.parameters.temperature})
                        </Label>
                        <Input
                          id="model-temperature"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={modelForm.parameters.temperature}
                          onChange={(e) => setModelForm({
                            ...modelForm,
                            parameters: { ...modelForm.parameters, temperature: parseFloat(e.target.value) || 0.7 },
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="model-maxTokens" className="text-xs text-muted-foreground">
                          最大输出 Tokens
                        </Label>
                        <Input
                          id="model-maxTokens"
                          type="number"
                          min="1"
                          value={modelForm.parameters.maxTokens}
                          onChange={(e) => setModelForm({
                            ...modelForm,
                            parameters: { ...modelForm.parameters, maxTokens: parseInt(e.target.value) || 4096 },
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 模型能力配置 */}
                  <div className="space-y-3 pt-2 border-t">
                    <Label>模型能力</Label>
                    
                    {/* 深度思考配置 */}
                    <div className="space-y-2 p-3 rounded-md bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="thinking-supported" className="text-sm font-normal">
                          支持深度思考
                        </Label>
                        <Switch
                          id="thinking-supported"
                          checked={modelForm.capabilities.thinking.supported}
                          onCheckedChange={(checked) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              thinking: {
                                ...modelForm.capabilities.thinking,
                                supported: checked,
                              },
                            },
                          })}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        是否启用深度思考可在 AI 助手面板中动态切换
                      </p>
                      
                      {modelForm.capabilities.thinking.supported && (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="thinking-api-format" className="text-xs text-muted-foreground">
                              API 格式
                            </Label>
                            <Select
                              value={modelForm.capabilities.thinking.apiFormat}
                              onValueChange={(value: "standard" | "openai") => setModelForm({
                                ...modelForm,
                                capabilities: {
                                  ...modelForm.capabilities,
                                  thinking: { ...modelForm.capabilities.thinking, apiFormat: value },
                                },
                              })}
                            >
                              <SelectTrigger id="thinking-api-format">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">标准格式 (智谱/DeepSeek 等)</SelectItem>
                                <SelectItem value="openai">OpenAI 格式 (o1/o3/gpt-5)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {modelForm.capabilities.thinking.apiFormat === "openai" && (
                            <div className="space-y-1">
                              <Label htmlFor="reasoning-summary" className="text-xs text-muted-foreground">
                                推理摘要
                              </Label>
                              <Select
                                value={modelForm.capabilities.thinking.reasoningSummary}
                                onValueChange={(value: "auto" | "detailed" | "concise" | "disabled") => setModelForm({
                                  ...modelForm,
                                  capabilities: {
                                    ...modelForm.capabilities,
                                    thinking: { ...modelForm.capabilities.thinking, reasoningSummary: value },
                                  },
                                })}
                              >
                                <SelectTrigger id="reasoning-summary">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">自动</SelectItem>
                                  <SelectItem value="detailed">详细</SelectItem>
                                  <SelectItem value="concise">简洁</SelectItem>
                                  <SelectItem value="disabled">禁用</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                OpenAI 不返回原始思维链，仅提供推理摘要。推理努力程度可在 AI 助手面板中选择。
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 其他能力 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <Label htmlFor="streaming-supported" className="text-sm font-normal">
                          流式输出
                        </Label>
                        <Switch
                          id="streaming-supported"
                          checked={modelForm.capabilities.streaming.supported && modelForm.capabilities.streaming.enabled}
                          onCheckedChange={(checked) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              streaming: { supported: checked, enabled: checked },
                            },
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <Label htmlFor="function-calling-supported" className="text-sm font-normal">
                          工具调用
                        </Label>
                        <Switch
                          id="function-calling-supported"
                          checked={modelForm.capabilities.functionCalling.supported}
                          onCheckedChange={(checked) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              functionCalling: { supported: checked },
                            },
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                        <Label htmlFor="vision-supported" className="text-sm font-normal">
                          视觉理解
                        </Label>
                        <Switch
                          id="vision-supported"
                          checked={modelForm.capabilities.vision.supported}
                          onCheckedChange={(checked) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              vision: { supported: checked },
                            },
                          })}
                        />
                      </div>
                    </div>

                    {/* 自动多步推理配置 */}
                    <div className="space-y-2 p-3 rounded-md bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ailoop-maxcount" className="text-sm font-normal">
                          自动多步推理次数上限
                        </Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AI 在处理复杂任务时，可能需要多次调用工具并自动继续推理
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          id="ailoop-maxcount"
                          type="number"
                          min="1"
                          max="100"
                          value={modelForm.capabilities.aiLoop.maxLoopCount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            // 允许输入但限制范围，空值默认为 20
                            const clampedValue = isNaN(value) ? 20 : Math.min(100, Math.max(1, value));
                            setModelForm({
                              ...modelForm,
                              capabilities: {
                                ...modelForm.capabilities,
                                aiLoop: { ...modelForm.capabilities.aiLoop, maxLoopCount: clampedValue },
                              },
                            });
                          }}
                          className="w-24"
                          disabled={modelForm.capabilities.aiLoop.unlimitedLoop}
                        />
                        <span className="text-xs text-muted-foreground">
                          (1-100)
                        </span>
                      </div>
                      
                      {/* 不限制循环次数开关 */}
                      <div className="flex items-center justify-between pt-2 border-t border-dashed">
                        <div className="flex-1">
                          <Label htmlFor="unlimited-loop" className="text-sm font-normal text-destructive">
                            不限制推理次数
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            允许 AI 无限次调用工具，直到任务完成
                          </p>
                        </div>
                        <Switch
                          id="unlimited-loop"
                          checked={modelForm.capabilities.aiLoop.unlimitedLoop}
                          onCheckedChange={(checked) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              aiLoop: { ...modelForm.capabilities.aiLoop, unlimitedLoop: checked },
                            },
                          })}
                        />
                      </div>
                      {modelForm.capabilities.aiLoop.unlimitedLoop && (
                        <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                          <p className="text-xs text-destructive font-medium">
                            警告：启用此选项存在风险
                          </p>
                          <ul className="text-xs text-destructive/80 mt-1 list-disc list-inside space-y-0.5">
                            <li>可能导致 AI 陷入无限循环</li>
                            <li>可能产生大量 API 调用费用</li>
                            <li>建议仅在受信任的任务中使用</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveModel}
                    disabled={createModelMutation.isLoading || updateModelMutation.isLoading}
                  >
                    {(createModelMutation.isLoading || updateModelMutation.isLoading) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingModel ? "保存" : "添加"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {models && models.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>模型名称</TableHead>
                  <TableHead>供应商</TableHead>
                  <TableHead>模型标识</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {models.map((model: any) => (
                  <TableRow key={model.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {model.displayName}
                        {model.isDefault && (
                          <Badge variant="outline" className="text-xs">默认</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getProviderName(model.providerId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">
                      {model.modelId}
                    </TableCell>
                    <TableCell>
                      {model.enabled ? (
                        <Badge variant="default" className="bg-green-500">启用</Badge>
                      ) : (
                        <Badge variant="secondary">禁用</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTestDialog(model)}
                        title="测试对话"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditModel(model)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModel(model)}
                        disabled={deleteModelMutation.isLoading}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p>暂未配置 AI 模型</p>
              <p className="text-xs mt-1">
                {providers && providers.length > 0
                  ? "点击上方按钮添加模型配置"
                  : "请先添加 AI 供应商"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">配置说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-1">常见 API 地址：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>OpenAI: https://api.openai.com/v1</li>
              <li>Azure OpenAI: https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT</li>
              <li>Claude: https://api.anthropic.com/v1</li>
              <li>Gemini: https://generativelanguage.googleapis.com/v1beta</li>
              <li>通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1</li>
              <li>DeepSeek: https://api.deepseek.com/v1</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">功能说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>AI 功能将用于智能写作辅助、内容优化等场景</li>
              <li>API Key 会安全存储在本地数据库中</li>
              <li>设置默认模型后，AI 功能将优先使用该模型</li>
              <li>可以配置多个供应商和模型，方便切换使用</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* 测试对话框 */}
      <Dialog open={showTestDialog} onOpenChange={(open) => {
        setShowTestDialog(open);
        if (!open) {
          setTestingModel(null);
          setTestResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              测试 AI 对话
            </DialogTitle>
            <DialogDescription>
              {testingModel && (
                <span>
                  供应商: {getProviderName(testingModel.providerId)} | 模型: {testingModel.displayName}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* 输入区域 */}
            <div className="space-y-2">
              <Label htmlFor="test-input">测试消息</Label>
              <Textarea
                id="test-input"
                placeholder="输入要发送给 AI 的消息..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="resize-none h-20"
              />
            </div>

            {/* 发送按钮 */}
            <Button
              onClick={handleSendTestMessage}
              disabled={testLoading || !testInput.trim()}
              className="w-full"
            >
              {testLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  正在请求...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  发送测试消息
                </>
              )}
            </Button>

            {/* 思维链显示（深度思考模式） */}
            {(isReasoning || testReasoningContent) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    深度思考
                  </Label>
                  {isReasoning && (
                    <Loader2 className="h-3 w-3 animate-spin text-amber-500" />
                  )}
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    思维链
                  </Badge>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-sm whitespace-pre-wrap max-h-[150px] overflow-y-auto text-amber-800 dark:text-amber-200">
                  {testReasoningContent || (isReasoning ? "正在思考..." : "")}
                </div>
              </div>
            )}

            {/* 流式输出显示（实时更新） */}
            {(testLoading || testStreamContent) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">AI 回复</Label>
                  {testLoading && !isReasoning && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                  {testResult?.streamSupported !== undefined && (
                    <Badge variant={testResult.streamSupported ? "default" : "secondary"} className="text-xs">
                      {testResult.streamSupported ? "流式输出" : "普通请求"}
                    </Badge>
                  )}
                  {testResult?.hasReasoning && (
                    <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                      深度思考
                    </Badge>
                  )}
                </div>
                <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {testStreamContent || (testLoading && !isReasoning ? "等待响应..." : "")}
                </div>
              </div>
            )}

            {/* 结果显示 */}
            {testResult && (
              <div className="space-y-3">
                {/* 状态提示 */}
                <div className={cn(
                  "flex items-center gap-2 rounded-md p-3 text-sm",
                  testResult.success
                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                )}>
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{testResult.message}</span>
                </div>

                {/* 使用统计 */}
                {testResult.success && testResult.usage && (
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      耗时: {testResult.duration}ms
                    </span>
                    <span>输入 Tokens: {testResult.usage.promptTokens}</span>
                    <span>输出 Tokens: {testResult.usage.completionTokens}</span>
                    <span>总计: {testResult.usage.totalTokens}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
