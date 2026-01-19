import { useState } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  LogOut,
  Key,
  Sparkles,
  Copy,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

export function ClaudeCodeConnect() {
  const utils = trpc.useContext();

  const { data: status, isLoading: statusLoading } =
    trpc.claudeCodeAuth.getStatus.useQuery();

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authTab, setAuthTab] = useState<"oauth" | "apikey">("oauth");
  const [authStep, setAuthStep] = useState<
    "idle" | "starting" | "waiting" | "completing" | "success" | "error"
  >("idle");
  const [subscriptionType, setSubscriptionType] = useState<"max" | "pro">("max");
  const [authorizeUrl, setAuthorizeUrl] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const startOAuthMutation = trpc.claudeCodeAuth.startOAuthFlow.useMutation({
    onSuccess: async (data: { authorizeUrl: string; expiresIn: number }) => {
      setAuthorizeUrl(data.authorizeUrl);
      setAuthStep("waiting");

      try {
        await navigator.clipboard.writeText(data.authorizeUrl);
        message.success("授权链接已复制到剪贴板，请在浏览器中打开");
      } catch {
        message.info("请复制下方链接在浏览器中打开");
      }
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setAuthStep("error");
    },
  });

  const completeOAuthMutation = trpc.claudeCodeAuth.completeOAuthFlow.useMutation({
    onSuccess: () => {
      setAuthStep("success");
      utils.claudeCodeAuth.getStatus.invalidate();
      utils.aiConfig.listProviders.invalidate();
      utils.aiConfig.listModels.invalidate();
      message.success("Claude Code 连接成功");

      setTimeout(() => {
        setShowAuthDialog(false);
        resetAuthState();
      }, 1500);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setAuthStep("error");
    },
  });

  const cancelAuthMutation = trpc.claudeCodeAuth.cancelOAuthFlow.useMutation();

  const saveApiKeyMutation = trpc.claudeCodeAuth.saveApiKey.useMutation({
    onSuccess: () => {
      setAuthStep("success");
      utils.claudeCodeAuth.getStatus.invalidate();
      utils.aiConfig.listProviders.invalidate();
      utils.aiConfig.listModels.invalidate();
      message.success("API Key 保存成功");

      setTimeout(() => {
        setShowAuthDialog(false);
        resetAuthState();
      }, 1500);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message);
      setAuthStep("error");
    },
  });

  const disconnectMutation = trpc.claudeCodeAuth.disconnect.useMutation({
    onSuccess: () => {
      utils.claudeCodeAuth.getStatus.invalidate();
      utils.aiConfig.listProviders.invalidate();
      utils.aiConfig.listModels.invalidate();
      message.success("已断开 Claude Code 连接");
    },
    onError: (error: Error) => {
      message.error(`断开连接失败: ${error.message}`);
    },
  });

  const refreshTokenMutation = trpc.claudeCodeAuth.refreshToken.useMutation({
    onSuccess: () => {
      utils.claudeCodeAuth.getStatus.invalidate();
      message.success("Token 已刷新");
    },
    onError: (error: Error) => {
      message.error(`刷新 Token 失败: ${error.message}`);
    },
  });

  const resetAuthState = () => {
    setAuthStep("idle");
    setAuthorizeUrl("");
    setAuthCode("");
    setApiKey("");
    setErrorMessage("");
    setSubscriptionType("max");
  };

  const handleStartOAuth = () => {
    resetAuthState();
    setShowAuthDialog(true);
    setAuthTab("oauth");
    setAuthStep("starting");
    startOAuthMutation.mutate({ subscriptionType });
  };

  const handleOpenAuthDialog = () => {
    resetAuthState();
    setShowAuthDialog(true);
    setAuthStep("idle");
  };

  const handleCancelAuth = () => {
    cancelAuthMutation.mutate();
    setShowAuthDialog(false);
    resetAuthState();
  };

  const handleCompleteOAuth = () => {
    if (!authCode.trim()) {
      message.error("请输入授权码");
      return;
    }
    setAuthStep("completing");
    completeOAuthMutation.mutate({ code: authCode.trim() });
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) {
      message.error("请输入 API Key");
      return;
    }
    setAuthStep("completing");
    saveApiKeyMutation.mutate({ apiKey: apiKey.trim() });
  };

  const handleDisconnect = () => {
    if (confirm("确定要断开 Claude Code 连接吗？这将删除相关的供应商和模型配置。")) {
      disconnectMutation.mutate();
    }
  };

  const renderAuthTypeBadge = () => {
    if (!status?.connected) return null;
    
    if (status.authType === "api_key") {
      return (
        <Badge variant="outline" className="ml-2">
          <Key className="h-3 w-3 mr-1" />
          API Key
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="ml-2">
        <Sparkles className="h-3 w-3 mr-1" />
        {status.subscriptionType === "max" ? "Claude Max" : "Claude Pro"}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
              </svg>
              Claude Code
              {renderAuthTypeBadge()}
            </CardTitle>
            <CardDescription>
              使用 Claude Code 订阅或 API Key 访问 Claude Sonnet 4、Claude 3.7 等模型
            </CardDescription>
          </div>
          {statusLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status?.connected ? (
            <Badge variant="default" className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              已连接
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="h-3 w-3 mr-1" />
              未连接
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {status.email || (status.authType === "api_key" ? "API Key 用户" : "Claude 用户")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {status.authType === "api_key"
                    ? "使用 API Key 认证"
                    : status.isExpired
                    ? "Token 已过期，请刷新"
                    : `Token 有效期至 ${new Date(status.expiresAt!).toLocaleString()}`}
                </p>
              </div>
              <div className="flex gap-2">
                {status.authType === "oauth" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refreshTokenMutation.mutate()}
                    disabled={refreshTokenMutation.isLoading}
                  >
                    {refreshTokenMutation.isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-1">刷新</span>
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isLoading}
                >
                  {disconnectMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                  <span className="ml-1">断开</span>
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>已自动创建 Claude Code 供应商和默认模型配置。</p>
              <p>您可以在下方的"AI 模型"部分管理具体模型。</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              连接 Claude Code 后，您可以使用 Claude Sonnet 4、Claude 3.7 Sonnet 等强大的 AI 模型。
            </p>
            <Button onClick={handleOpenAuthDialog}>
              <Sparkles className="h-4 w-4 mr-2" />
              连接 Claude Code
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={showAuthDialog} onOpenChange={(open) => {
        if (!open) {
          handleCancelAuth();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              连接 Claude Code
            </DialogTitle>
            <DialogDescription>
              选择认证方式连接您的 Claude 账号
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {authStep === "idle" && (
              <Tabs value={authTab} onValueChange={(v: string) => setAuthTab(v as "oauth" | "apikey")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="oauth">OAuth 授权</TabsTrigger>
                  <TabsTrigger value="apikey">API Key</TabsTrigger>
                </TabsList>
                
                <TabsContent value="oauth" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <Label>选择订阅类型</Label>
                    <RadioGroup
                      value={subscriptionType}
                      onValueChange={(v) => setSubscriptionType(v as "max" | "pro")}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="max" id="max" />
                        <Label htmlFor="max" className="cursor-pointer">
                          <span className="font-medium">Claude Max</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            (claude.ai 订阅用户)
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="pro" id="pro" />
                        <Label htmlFor="pro" className="cursor-pointer">
                          <span className="font-medium">Claude Pro</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            (console.anthropic.com 用户)
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleStartOAuth}
                    disabled={startOAuthMutation.isLoading}
                  >
                    {startOAuthMutation.isLoading && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    开始授权
                  </Button>
                </TabsContent>
                
                <TabsContent value="apikey" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="apikey">Anthropic API Key</Label>
                    <Input
                      id="apikey"
                      type="password"
                      placeholder="sk-ant-api..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      从 console.anthropic.com 获取 API Key
                    </p>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={handleSaveApiKey}
                    disabled={saveApiKeyMutation.isLoading || !apiKey.trim()}
                  >
                    {saveApiKeyMutation.isLoading && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    保存 API Key
                  </Button>
                </TabsContent>
              </Tabs>
            )}

            {authStep === "starting" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在启动授权流程...</p>
              </div>
            )}

            {authStep === "waiting" && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    请复制下方链接在浏览器中打开完成授权，然后将授权码粘贴到下方：
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>授权链接</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={authorizeUrl}
                      className="text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(authorizeUrl);
                          message.success("已复制");
                        } catch {
                          message.error("复制失败");
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authCode">授权码</Label>
                  <Input
                    id="authCode"
                    placeholder="粘贴从浏览器获取的授权码..."
                    value={authCode}
                    onChange={(e) => setAuthCode(e.target.value)}
                  />
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCompleteOAuth}
                  disabled={!authCode.trim() || completeOAuthMutation.isLoading}
                >
                  {completeOAuthMutation.isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  完成授权
                </Button>
              </div>
            )}

            {authStep === "completing" && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在验证...</p>
              </div>
            )}

            {authStep === "success" && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-sm font-medium">连接成功！</p>
              </div>
            )}

            {authStep === "error" && (
              <div className="flex flex-col items-center gap-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-sm text-destructive">{errorMessage}</p>
                <Button variant="outline" onClick={() => {
                  resetAuthState();
                  setAuthStep("idle");
                }}>
                  重试
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            {(authStep === "idle" || authStep === "waiting") && (
              <Button variant="outline" onClick={handleCancelAuth}>
                取消
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
