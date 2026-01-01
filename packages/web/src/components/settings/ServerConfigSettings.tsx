import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Server,
  Cloud,
  RefreshCw,
  Loader2,
  Lock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import { message } from "antd";
import {
  getServerBaseUrl,
  setServerBaseUrl,
  testServerConnection,
  getAppMode,
  resetAppMode,
} from "@/utils/serverConfig";
import { isElectron } from "./utils";

// 服务器配置组件
export function ServerConfigSettings() {
  const navigate = useNavigate();
  const [baseUrl, setBaseUrlState] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [currentMode, setCurrentMode] = useState<"local" | "cloud" | null>(null);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // 加载当前配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const url = await getServerBaseUrl();
        setBaseUrlState(url);
        
        // 获取当前模式
        const modeConfig = await getAppMode();
        setCurrentMode(modeConfig.mode);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadConfig();
  }, []);

  // 是否为本地模式
  const isLocalMode = currentMode === "local";

  // 切换模式
  const handleSwitchMode = async () => {
    setIsSwitchingMode(true);
    try {
      // 重置应用模式，然后跳转到设置页面重新选择
      const result = await resetAppMode();
      if (result.success) {
        message.success("正在切换模式，请重新选择...");
        // 跳转到设置页面
        setTimeout(() => {
          navigate({ to: "/setup" });
        }, 500);
      } else {
        message.error("切换模式失败");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切换失败");
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!baseUrl.trim()) {
      setTestResult({ success: false, message: "请输入服务器地址" });
      return;
    }

    setIsTesting(true);
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
      setIsTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    if (!baseUrl.trim()) {
      message.error("请输入服务器地址");
      return;
    }

    setIsLoading(true);

    try {
      // 先测试连接
      const testResultData = await testServerConnection(baseUrl);
      if (!testResultData.success) {
        setTestResult({
          success: false,
          message: testResultData.message || "连接失败，请检查服务器地址",
        });
        setIsLoading(false);
        return;
      }

      // 保存配置
      const saveResult = await setServerBaseUrl(baseUrl);
      if (saveResult.success) {
        message.success("服务器配置已保存，页面即将刷新以应用新配置");
        // 延迟刷新页面以应用新配置
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        message.error(saveResult.message || "保存配置失败");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">服务器配置</h2>
        <p className="text-sm text-muted-foreground">
          配置服务器连接模式和地址
        </p>
      </div>

      {/* 当前模式显示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {isLocalMode ? (
              <>
                <Server className="h-4 w-4 text-green-500" />
                本地模式
              </>
            ) : (
              <>
                <Cloud className="h-4 w-4 text-blue-500" />
                云端模式
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isLocalMode
              ? "数据存储在本地，无需网络连接"
              : "连接到远程服务器，数据存储在云端"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isLocalMode ? "default" : "secondary"} className={isLocalMode ? "bg-green-500" : ""}>
                {isLocalMode ? "本地" : "云端"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                当前服务器：{baseUrl || "未配置"}
              </span>
            </div>
            {isElectron() && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSwitchMode}
                disabled={isSwitchingMode}
              >
                {isSwitchingMode ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                切换模式
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 本地模式：显示提示信息 */}
      {isLocalMode && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-green-600" />
              本地模式说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• 本地模式下，服务器地址由系统自动管理，无需手动配置</p>
            <p>• 所有数据存储在本地计算机上，更加安全私密</p>
            <p>• 如需使用云端服务器，请点击"切换模式"按钮重新配置</p>
          </CardContent>
        </Card>
      )}

      {/* 云端模式：显示服务器配置 */}
      {!isLocalMode && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">服务器地址</CardTitle>
              <CardDescription>
                设置后端服务器的 IP 地址或域名
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="serverUrl">服务器地址</Label>
                <Input
                  id="serverUrl"
                  placeholder="例如: http://localhost:3000 或 https://api.example.com"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrlState(e.target.value);
                    setTestResult(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  请输入完整的服务器地址，包含协议 (http/https) 和端口号
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

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || isLoading || !baseUrl.trim()}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  测试连接
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={isLoading || isTesting || !baseUrl.trim()}
                >
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  保存配置
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">配置说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• 修改服务器地址后，页面会自动刷新以应用新配置</p>
              <p>• 建议在修改前先测试连接，确保服务器地址正确</p>
              <p>• 如果服务器地址错误，可能导致无法正常使用应用功能</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
