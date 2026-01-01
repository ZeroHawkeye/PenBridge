// 掘金授权组件

import { useState } from "react";
import { User, LogOut, LogIn, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/utils/trpc";
import { isElectron } from "./utils";

export function JuejinAuthSettings() {
  const { data: authStatus, isLoading: statusLoading } = trpc.juejinAuth.status.useQuery();
  const utils = trpc.useContext();

  const [loginStatus, setLoginStatus] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [showCookieDialog, setShowCookieDialog] = useState(false);

  // 设置 Cookie 的 mutation
  const setCookiesMutation = trpc.juejinAuth.setCookies.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setLoginStatus("登录成功！");
        setShowCookieDialog(false);
        setCookieInput("");
        utils.juejinAuth.status.invalidate();
      } else {
        setLoginStatus(`登录失败: ${data.message}`);
      }
    },
    onError: (error: any) => {
      setLoginStatus(`登录失败: ${error.message}`);
    },
  });

  const logoutMutation = trpc.juejinAuth.logout.useMutation({
    onSuccess: () => {
      setLoginStatus("已退出登录");
      utils.juejinAuth.status.invalidate();
    },
  });

  const autoLoginMutation = trpc.juejinAuth.autoLogin.useMutation({
    onMutate: () => {
      setLoginStatus("正在尝试自动登录...");
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setLoginStatus("自动登录成功！");
        utils.juejinAuth.status.invalidate();
      } else {
        setLoginStatus(`自动登录失败: ${data.message}`);
      }
    },
    onError: (error: any) => {
      setLoginStatus(`自动登录失败: ${error.message}`);
    },
  });

  // Electron 客户端登录
  const handleElectronLogin = async () => {
    if (!isElectron()) return;

    setIsLoggingIn(true);
    setLoginStatus("正在打开登录窗口，请在弹出的窗口中完成登录...");

    try {
      const result = await window.electronAPI!.juejinAuth.login();
      if (result.success) {
        setLoginStatus("正在同步登录信息...");
        const cookies = await window.electronAPI!.juejinAuth.getCookies();
        if (cookies) {
          setCookiesMutation.mutate({
            cookies,
            nickname: result.user?.nickname,
            avatarUrl: result.user?.avatarUrl,
            userId: result.user?.userId,
          });
        }
      } else {
        setLoginStatus(`登录失败: ${result.message}`);
      }
    } catch (error: any) {
      setLoginStatus(`登录失败: ${error.message}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 手动输入 Cookie 登录
  const handleManualCookieLogin = () => {
    if (!cookieInput.trim()) {
      setLoginStatus("请输入 Cookie");
      return;
    }

    let cookiesJson = cookieInput.trim();

    if (!cookiesJson.startsWith("[")) {
      const cookies = cookiesJson.split(";").map((item) => {
        const [name, ...valueParts] = item.trim().split("=");
        return {
          name: name.trim(),
          value: valueParts.join("=").trim(),
          domain: ".juejin.cn",
        };
      }).filter(c => c.name && c.value);
      cookiesJson = JSON.stringify(cookies);
    }

    setCookiesMutation.mutate({ cookies: cookiesJson });
  };

  const isLoading = isLoggingIn || autoLoginMutation.isLoading || setCookiesMutation.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">掘金</h2>
        <p className="text-sm text-muted-foreground">
          登录掘金以发布文章到该平台
        </p>
      </div>

      {/* 当前状态 */}
      <Card>
        <CardContent className="pt-6">
          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : authStatus?.isLoggedIn ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {authStatus.user?.avatarUrl ? (
                  <img
                    src={authStatus.user.avatarUrl}
                    alt="头像"
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-full ring-2 ring-primary/10 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                )}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-base sm:text-lg truncate">{authStatus.user?.nickname || "用户"}</p>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-500 shrink-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已登录
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    已绑定掘金账号
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
              >
                {logoutMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4 mr-2" />
                )}
                退出登录
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-lg text-muted-foreground">未登录</p>
                  <Badge variant="secondary">
                    <XCircle className="h-3 w-3 mr-1" />
                    未授权
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  请登录以发布文章到掘金
                </p>
              </div>
            </div>
          )}

          {loginStatus && (
            <div className={cn(
              "text-sm p-3 rounded-md mt-4",
              loginStatus.includes("成功")
                ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                : loginStatus.includes("失败")
                  ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  : "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            )}>
              {loginStatus}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 登录选项 */}
      {!authStatus?.isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">登录方式</CardTitle>
            <CardDescription>
              选择一种方式登录
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isElectron() ? (
              <Button
                onClick={handleElectronLogin}
                disabled={isLoading}
                className="w-full"
              >
                <LogIn className="h-4 w-4 mr-2" />
                打开登录窗口
              </Button>
            ) : (
              <Dialog open={showCookieDialog} onOpenChange={setShowCookieDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full" disabled={isLoading}>
                    <LogIn className="h-4 w-4 mr-2" />
                    手动输入 Cookie
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>手动输入 Cookie</DialogTitle>
                    <DialogDescription>
                      从浏览器获取 Cookie 并粘贴到下方
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p className="font-medium">如何获取 Cookie：</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>打开浏览器访问 juejin.cn</li>
                        <li>完成登录</li>
                        <li>按 F12 打开开发者工具</li>
                        <li>切换到 Application 标签</li>
                        <li>找到 Cookies -&gt; juejin.cn</li>
                        <li>复制所需的 Cookie（sessionid, sid_guard 等）</li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="juejin-cookie">Cookie</Label>
                      <Textarea
                        id="juejin-cookie"
                        placeholder="粘贴 Cookie..."
                        value={cookieInput}
                        onChange={(e) => setCookieInput(e.target.value)}
                        className="resize-none h-24 [field-sizing:fixed] overflow-x-hidden break-all"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleManualCookieLogin}
                      disabled={setCookiesMutation.isLoading}
                    >
                      确认登录
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            <Button
              variant="outline"
              onClick={() => autoLoginMutation.mutate()}
              disabled={isLoading}
              className="w-full"
            >
              <RefreshCw className={cn(
                "h-4 w-4 mr-2",
                autoLoginMutation.isLoading && "animate-spin"
              )} />
              自动登录（使用已保存的信息）
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              {isElectron()
                ? "登录窗口会打开掘金首页，您可以使用微信扫码等方式登录"
                : "推荐使用 Electron 客户端获得更好的登录体验"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
