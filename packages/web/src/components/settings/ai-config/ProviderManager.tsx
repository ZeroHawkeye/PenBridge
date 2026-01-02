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
import { trpc } from "@/utils/trpc";
import { message } from "antd";
import type { Provider, ProviderFormData } from "./types";

interface ProviderManagerProps {
  providers: Provider[] | undefined;
}

export function ProviderManager({ providers }: ProviderManagerProps) {
  const utils = trpc.useContext();

  // 供应商表单状态
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderFormData>({
    name: "",
    baseUrl: "",
    apiKey: "",
    sdkType: "openai-compatible",
  });

  // 显示 API Key 状态
  const [showApiKey, setShowApiKey] = useState(false);

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

  const resetProviderForm = () => {
    setProviderForm({ name: "", baseUrl: "", apiKey: "", sdkType: "openai-compatible" });
    setShowApiKey(false);
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider);
    setProviderForm({
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
      sdkType: provider.sdkType || "openai-compatible",
    });
    setShowProviderDialog(true);
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

  const handleDeleteProvider = (provider: Provider) => {
    if (confirm(`确定要删除供应商 "${provider.name}" 吗？这将同时删除该供应商下的所有模型配置。`)) {
      deleteProviderMutation.mutate({ id: provider.id });
    }
  };

  return (
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
                  <Label htmlFor="provider-sdkType">SDK 类型</Label>
                  <Select
                    value={providerForm.sdkType}
                    onValueChange={(value: "openai" | "openai-compatible") => setProviderForm({ ...providerForm, sdkType: value })}
                  >
                    <SelectTrigger id="provider-sdkType">
                      <SelectValue placeholder="选择 SDK 类型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI 官方</SelectItem>
                      <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {providerForm.sdkType === "openai" 
                      ? "仅用于 OpenAI 官方 API (api.openai.com)，原生支持 o1/o3/gpt-5 推理"
                      : "适用于智谱、DeepSeek、通义千问、Moonshot 等兼容 OpenAI 格式的服务商"}
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
              {providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell className="font-medium">{provider.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                    {provider.baseUrl}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {provider.sdkType === "openai" ? "OpenAI" : "兼容"}
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
  );
}
