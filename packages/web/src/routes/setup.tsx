import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Server,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Monitor,
  Cloud,
  Zap,
  Shield,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  setServerBaseUrl,
  testServerConnection,
  isServerConfigured,
  getServerBaseUrl,
  isElectron,
  setAppMode,
  getAppMode,
} from "@/utils/serverConfig";

// 导入类型定义
import "@/types/electron.d";
import type { AppMode } from "@/types/electron.d";

// 定义搜索参数类型
type SetupSearchParams = {
  reconfigure?: boolean;
};

// 设置步骤
type SetupStep = "mode-select" | "cloud-config";

function SetupPage() {
  const navigate = useNavigate();
  const { reconfigure } = useSearch({ from: "/setup" }) as SetupSearchParams;
  const [step, setStep] = useState<SetupStep>("mode-select");
  const [baseUrl, setBaseUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isCheckingConfig, setIsCheckingConfig] = useState(true);
  const [currentMode, setCurrentMode] = useState<AppMode>(null);
  const [localServerStatus, setLocalServerStatus] = useState<{
    running: boolean;
    healthy: boolean;
  } | null>(null);

  // 检查是否已经配置过
  useEffect(() => {
    const checkConfig = async () => {
      const configured = await isServerConfigured();
      if (configured) {
        if (reconfigure) {
          // 重新配置模式，加载当前配置
          if (isElectron()) {
            const modeConfig = await getAppMode();
            setCurrentMode(modeConfig.mode);
            if (modeConfig.mode === "cloud") {
              const currentUrl = await getServerBaseUrl();
              setBaseUrl(currentUrl);
              setStep("cloud-config");
            }
          } else {
            const currentUrl = await getServerBaseUrl();
            setBaseUrl(currentUrl);
            setStep("cloud-config");
          }
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

  // 检查本地服务器状态
  useEffect(() => {
    if (!isElectron()) return;

    const checkLocalServer = async () => {
      try {
        const status = await window.electronAPI!.appMode.getLocalServerStatus();
        setLocalServerStatus(status);
      } catch {
        setLocalServerStatus(null);
      }
    };

    checkLocalServer();
    // 每隔5秒检查一次
    const interval = setInterval(checkLocalServer, 5000);
    return () => clearInterval(interval);
  }, []);

  // 选择本地模式
  const handleSelectLocalMode = async () => {
    if (!isElectron()) {
      setTestResult({ success: false, message: "浏览器环境不支持本地模式" });
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      const result = await setAppMode("local");
      if (result.success) {
        // 刷新页面以应用新配置
        window.location.href = window.location.pathname + "#/login";
        window.location.reload();
      } else {
        setTestResult({
          success: false,
          message: result.message || "启动本地服务失败",
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "启动失败",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 选择云端模式
  const handleSelectCloudMode = () => {
    setStep("cloud-config");
    setTestResult(null);
  };

  // 返回模式选择
  const handleBackToModeSelect = () => {
    setStep("mode-select");
    setTestResult(null);
  };

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
        // 如果是 Electron 环境，设置为云端模式
        if (isElectron()) {
          await setAppMode("cloud");
        }
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

  // 模式选择页面
  if (step === "mode-select") {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
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
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Server className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {reconfigure ? "选择运行模式" : "欢迎使用 PenBridge"}
            </h1>
            <p className="text-muted-foreground">
              {reconfigure
                ? "重新配置应用运行模式"
                : "请选择您希望的运行模式"}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 本地模式 - 仅在 Electron 环境显示 */}
            {isElectron() && (
              <Card
                className={cn(
                  "relative cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
                  currentMode === "local" && "border-primary ring-2 ring-primary/20"
                )}
                onClick={handleSelectLocalMode}
              >
                <CardHeader className="text-center pb-2">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <Monitor className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <CardTitle className="text-xl">本地模式</CardTitle>
                  <CardDescription>数据存储在本机，无需网络</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span>一键启动，开箱即用</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>数据完全保存在本地</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <WifiOff className="h-4 w-4 text-green-500" />
                    <span>无需服务器，离线可用</span>
                  </div>

                  {localServerStatus && (
                    <div
                      className={cn(
                        "mt-4 flex items-center gap-2 rounded-md p-2 text-xs",
                        localServerStatus.running && localServerStatus.healthy
                          ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      )}
                    >
                      {localServerStatus.running && localServerStatus.healthy ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          <span>本地服务运行中</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 rounded-full bg-slate-400" />
                          <span>点击启动本地服务</span>
                        </>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full mt-4"
                    disabled={isLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectLocalMode();
                    }}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Monitor className="h-4 w-4 mr-2" />
                    )}
                    {currentMode === "local" ? "当前模式" : "选择本地模式"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* 云端模式 */}
            <Card
              className={cn(
                "relative cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
                currentMode === "cloud" && "border-primary ring-2 ring-primary/20",
                !isElectron() && "md:col-span-2 max-w-md mx-auto w-full"
              )}
              onClick={handleSelectCloudMode}
            >
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <Cloud className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle className="text-xl">云端模式</CardTitle>
                <CardDescription>连接到远程服务器</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wifi className="h-4 w-4 text-blue-500" />
                  <span>多设备数据同步</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Server className="h-4 w-4 text-blue-500" />
                  <span>需要自建或使用云端服务器</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Cloud className="h-4 w-4 text-blue-500" />
                  <span>适合团队协作使用</span>
                </div>

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectCloudMode();
                  }}
                >
                  <Cloud className="h-4 w-4 mr-2" />
                  {currentMode === "cloud" ? "重新配置" : "配置云端服务器"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div
              className={cn(
                "mt-6 flex items-center gap-2 rounded-md p-3 text-sm",
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
        </div>
      </div>
    );
  }

  // 云端配置页面
  return (
    <div className="flex h-full items-center justify-center p-4">
      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center">
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4 text-slate-500 hover:text-slate-700"
            onClick={handleBackToModeSelect}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Cloud className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">配置云端服务器</CardTitle>
          <CardDescription>请输入您的服务器地址</CardDescription>
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
      reconfigure:
        search.reconfigure === true || search.reconfigure === "true",
    };
  },
});
