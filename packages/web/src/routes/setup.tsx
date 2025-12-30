import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Server, CheckCircle, XCircle, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  setServerBaseUrl,
  testServerConnection,
  isServerConfigured,
  getServerBaseUrl,
} from "@/utils/serverConfig";

// 导入类型定义
import "@/types/electron.d";

// 定义搜索参数类型
type SetupSearchParams = {
  reconfigure?: boolean;
};

function SetupPage() {
  const navigate = useNavigate();
  const { reconfigure } = useSearch({ from: "/setup" }) as SetupSearchParams;
  const [baseUrl, setBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);

  // 检查是否已经配置过
  useEffect(() => {
    const checkConfig = async () => {
      const configured = await isServerConfigured();
      if (configured) {
        if (reconfigure) {
          // 重新配置模式，加载当前配置
          const currentUrl = await getServerBaseUrl();
          setBaseUrl(currentUrl);
          setIsCheckingConfig(false);
        } else {
          // 已配置，跳转到登录页
          navigate({ to: "/login" });
        }
      } else {
        setIsCheckingConfig(false);
      }
    };
    checkConfig();
  }, [navigate, reconfigure]);

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ success: false, message: "请输入服务器地址" });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await testServerConnection(baseUrl);
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? "连接成功" : "连接失败"),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "测试失败",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 保存配置并继续
  const handleSaveAndContinue = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ success: false, message: "请输入服务器地址" });
      return;
    }

    setIsLoading(true);

    try {
      // 先测试连接
      const testResultData = await testServerConnection(baseUrl);
      if (!testResultData.success) {
        setTestResult({
          success: testResultData.success,
          message: testResultData.message || "连接失败",
        });
        setIsLoading(false);
        return;
      }

      // 保存配置
      const saveResult = await setServerBaseUrl(baseUrl);
      if (saveResult.success) {
        // 刷新页面以应用新配置
        window.location.href = window.location.pathname + "#/login";
        window.location.reload();
      } else {
        setTestResult({
          success: false,
          message: saveResult.message || "保存配置失败",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "操作失败",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 正在检查配置状态时显示加载
  if (isCheckingConfig) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center">
          {reconfigure && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 text-slate-500 hover:text-slate-700"
              onClick={() => navigate({ to: "/login" })}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回登录
            </Button>
          )}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Server className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {reconfigure ? "修改服务器配置" : "欢迎使用 PenBridge"}
          </CardTitle>
          <CardDescription>
            {reconfigure ? "重新配置云端服务器地址" : "首次使用，请配置云端服务器地址"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="baseUrl">服务器地址</Label>
            <Input
              id="baseUrl"
              placeholder="例如: http://localhost:3000 或 https://api.example.com"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setTestResult(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleTestConnection();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              请输入后端服务器的 IP 地址或域名，包含协议和端口号
            </p>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-md p-3 text-sm",
                testResult.success
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                  : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
              )}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isLoading || !baseUrl.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              测试连接
            </Button>
            <Button
              onClick={handleSaveAndContinue}
              disabled={isLoading || !baseUrl.trim()}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              保存并继续
            </Button>
          </div>

          <div className="text-center text-xs text-muted-foreground">
            <p>配置后可在设置页面修改服务器地址</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/setup")({
  component: SetupPage,
  validateSearch: (search: Record<string, unknown>): SetupSearchParams => {
    return {
      reconfigure: search.reconfigure === true || search.reconfigure === "true",
    };
  },
});
