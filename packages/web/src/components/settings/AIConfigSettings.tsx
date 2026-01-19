import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { CopilotConnect } from "./ai-config/CopilotConnect";
import { ClaudeCodeConnect } from "./ai-config/ClaudeCodeConnect";
import { ProviderManager } from "./ai-config/ProviderManager";
import { ModelManager } from "./ai-config/ModelManager";
import { TestDialog } from "./ai-config/TestDialog";
import type { Model, Provider } from "./ai-config/types";

// AI 配置组件
export function AIConfigSettings() {
  // 获取供应商列表
  const { data: providers, isLoading: providersLoading } = trpc.aiConfig.listProviders.useQuery();
  // 获取模型列表
  const { data: models, isLoading: modelsLoading } = trpc.aiConfig.listModels.useQuery({});

  // 测试对话状态
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testingModel, setTestingModel] = useState<Model | null>(null);

  const handleOpenTestDialog = (model: Model) => {
    setTestingModel(model);
    setShowTestDialog(true);
  };

  const getProviderName = (providerId: number) => {
    return (providers as Provider[] | undefined)?.find((p) => p.id === providerId)?.name || "未知供应商";
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

      <CopilotConnect />

      <ClaudeCodeConnect />

      {/* 供应商管理 */}
      <ProviderManager providers={providers as Provider[] | undefined} />

      {/* 模型管理 */}
      <ModelManager 
        providers={providers as Provider[] | undefined} 
        models={models as Model[] | undefined}
        onTestModel={handleOpenTestDialog}
      />

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
      <TestDialog
        open={showTestDialog}
        onOpenChange={setShowTestDialog}
        model={testingModel}
        getProviderName={getProviderName}
      />
    </div>
  );
}
