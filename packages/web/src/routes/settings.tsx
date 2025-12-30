import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { User, Cloud, Info, LogOut, LogIn, RefreshCw, Mail, Calendar, Trash2, Eye, EyeOff, Send, CheckCircle, XCircle, Clock, Loader2, Users, Plus, Pencil, Key, Shield, ShieldCheck, Server, PenLine, Sparkles } from "lucide-react";
import { isSuperAdmin, getAuthUser, AdminRole } from "@/utils/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
import { trpc } from "@/utils/trpc";
import { message } from "antd";

// 导入类型定义
import "@/types/electron.d";

import {
  getServerBaseUrl,
  setServerBaseUrl,
  testServerConnection,
} from "@/utils/serverConfig";
import {
  isSpellCheckEnabled,
  setSpellCheckEnabled,
  getCustomDictionary,
  removeFromCustomDictionary,
} from "@/utils/spellCheck";

// 菜单项类型
type MenuItem = {
  id: string;
  icon: typeof Cloud;
  label: string;
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

// 设置菜单项（用户管理仅超级管理员可见）
const getSettingsMenu = (): MenuGroup[] => {
  const groups: MenuGroup[] = [
    {
      title: "发布渠道",
      items: [
        { id: "tencent", icon: Cloud, label: "腾讯云社区" },
        { id: "juejin", icon: Sparkles, label: "掘金" },
      ],
    },
  {
      title: "系统设置",
      items: [
        { id: "schedule", icon: Calendar, label: "定时任务" },
        { id: "email", icon: Mail, label: "邮件通知" },
        { id: "server", icon: Server, label: "服务器配置" },
        { id: "editor", icon: PenLine, label: "编辑器设置" },
      ],
    },
  ];

  // 账户管理分组
  const accountItems: MenuItem[] = [];
  
  // 超级管理员可以管理用户
  if (isSuperAdmin()) {
    accountItems.push({ id: "users", icon: Users, label: "用户管理" });
  }

  // 所有用户都可以修改自己的密码
  accountItems.push({ id: "account", icon: Key, label: "账号安全" });
  
  groups.push({
    title: "账户管理",
    items: accountItems,
  });

  // 其他分组
  groups.push({
    title: "其他",
    items: [
      { id: "about", icon: Info, label: "关于" },
    ],
  });

  return groups;
};

// 检测是否在 Electron 环境中
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};

// 腾讯云开发者社区授权组件（发布渠道之一）
function TencentAuthSettings() {
  const { data: authStatus, isLoading: statusLoading } = trpc.auth.status.useQuery();
  const utils = trpc.useContext();

  const [loginStatus, setLoginStatus] = useState<string>("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [cookieInput, setCookieInput] = useState("");
  const [showCookieDialog, setShowCookieDialog] = useState(false);

  // 设置 Cookie 的 mutation
  const setCookiesMutation = trpc.auth.setCookies.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setLoginStatus("登录成功！");
        setShowCookieDialog(false);
        setCookieInput("");
        utils.auth.status.invalidate();
      } else {
        setLoginStatus(`登录失败: ${data.message}`);
      }
    },
    onError: (error: any) => {
      setLoginStatus(`登录失败: ${error.message}`);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      setLoginStatus("已退出登录");
      utils.auth.status.invalidate();
    },
  });

  const autoLoginMutation = trpc.auth.autoLogin.useMutation({
    onMutate: () => {
      setLoginStatus("正在尝试自动登录...");
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setLoginStatus("自动登录成功！");
        utils.auth.status.invalidate();
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
      const result = await window.electronAPI!.auth.login();
      if (result.success) {
        setLoginStatus("正在同步登录信息...");
        const cookies = await window.electronAPI!.auth.getCookies();
        if (cookies) {
          setCookiesMutation.mutate({
            cookies,
            nickname: result.user?.nickname,
            avatarUrl: result.user?.avatarUrl,
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
          domain: ".cloud.tencent.com",
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
        <h2 className="text-lg font-semibold">腾讯云开发者社区</h2>
        <p className="text-sm text-muted-foreground">
          登录腾讯云开发者社区以发布文章到该平台
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {authStatus.user?.avatarUrl ? (
                  <img
                    src={authStatus.user.avatarUrl}
                    alt="头像"
                    className="w-14 h-14 rounded-full ring-2 ring-primary/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">{authStatus.user?.nickname || "用户"}</p>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已登录
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    已绑定腾讯云开发者社区
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                  请登录以发布文章到腾讯云开发者社区
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
                        <li>打开浏览器访问 cloud.tencent.com/developer</li>
                        <li>完成登录</li>
                        <li>按 F12 打开开发者工具</li>
                        <li>切换到 Application 标签</li>
                        <li>找到 Cookies → cloud.tencent.com</li>
                        <li>复制所需的 Cookie</li>
                      </ol>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cookie">Cookie</Label>
                      <Textarea
                        id="cookie"
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
                ? "登录窗口会打开登录页面，您可以使用微信扫码等方式登录"
                : "推荐使用 Electron 客户端获得更好的登录体验"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 掘金授权组件（发布渠道之一）
function JuejinAuthSettings() {
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {authStatus.user?.avatarUrl ? (
                  <img
                    src={authStatus.user.avatarUrl}
                    alt="头像"
                    className="w-14 h-14 rounded-full ring-2 ring-primary/10"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-lg">{authStatus.user?.nickname || "用户"}</p>
                    <Badge variant="default" className="bg-green-500 hover:bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      已登录
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    已绑定掘金账号
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoutMutation.mutate()}
                disabled={logoutMutation.isLoading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
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

// 邮件通知设置组件
function EmailNotificationSettings() {
  const { data: emailConfig, isLoading } = trpc.emailConfig.get.useQuery();
  const utils = trpc.useContext();

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    smtpHost: "",
    smtpPort: 465,
    smtpSecure: true,
    smtpUser: "",
    smtpPass: "",
    fromName: "",
    fromEmail: "",
    notifyEmail: "",
    notifyOnSuccess: true,
    notifyOnFailed: true,
    notifyOnCookieExpired: true,
    enabled: false,
  });

  // 同步配置到表单
  useEffect(() => {
    if (emailConfig) {
      setFormData({
        smtpHost: emailConfig.smtpHost || "",
        smtpPort: emailConfig.smtpPort || 465,
        smtpSecure: emailConfig.smtpSecure ?? true,
        smtpUser: emailConfig.smtpUser || "",
        smtpPass: emailConfig.smtpPass || "",
        fromName: emailConfig.fromName || "",
        fromEmail: emailConfig.fromEmail || "",
        notifyEmail: emailConfig.notifyEmail || "",
        notifyOnSuccess: emailConfig.notifyOnSuccess ?? true,
        notifyOnFailed: emailConfig.notifyOnFailed ?? true,
        notifyOnCookieExpired: emailConfig.notifyOnCookieExpired ?? true,
        enabled: emailConfig.enabled ?? false,
      });
    }
  }, [emailConfig]);

  // 保存配置
  const saveMutation = trpc.emailConfig.save.useMutation({
    onSuccess: () => {
      message.success("配置已保存");
      utils.emailConfig.get.invalidate();
    },
    onError: (error: Error) => {
      message.error(`保存失败: ${error.message}`);
    },
  });

  // 验证 SMTP 配置
  const verifyMutation = trpc.emailConfig.verify.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        message.success("SMTP 配置验证成功");
      } else {
        message.error(result.message);
      }
    },
    onError: (error: Error) => {
      message.error(`验证失败: ${error.message}`);
    },
  });

  // 发送测试邮件
  const testMutation = trpc.emailConfig.sendTest.useMutation({
    onSuccess: (result: any) => {
      if (result.success) {
        message.success("测试邮件已发送");
      } else {
        message.error(result.message);
      }
    },
    onError: (error: Error) => {
      message.error(`发送失败: ${error.message}`);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleVerify = () => {
    verifyMutation.mutate({
      smtpHost: formData.smtpHost,
      smtpPort: formData.smtpPort,
      smtpSecure: formData.smtpSecure,
      smtpUser: formData.smtpUser,
      smtpPass: formData.smtpPass,
    });
  };

  const handleSendTest = () => {
    testMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">邮件通知</h2>
        <p className="text-sm text-muted-foreground">
          配置 SMTP 邮件服务，用于接收定时发布结果通知
        </p>
      </div>

      {/* 启用开关 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              启用邮件通知
            </span>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </CardTitle>
          <CardDescription>
            启用后，定时任务执行结果将通过邮件发送到您的邮箱
          </CardDescription>
        </CardHeader>
      </Card>

      {/* SMTP 服务器配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP 服务器配置</CardTitle>
          <CardDescription>
            配置用于发送邮件的 SMTP 服务器信息
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">SMTP 服务器</Label>
              <Input
                id="smtpHost"
                placeholder="如: smtp.qq.com"
                value={formData.smtpHost}
                onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">端口</Label>
              <Select
                value={formData.smtpPort.toString()}
                onValueChange={(value) => setFormData({ ...formData, smtpPort: parseInt(value), smtpSecure: value === "465" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择端口" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="465">465 (SSL)</SelectItem>
                  <SelectItem value="587">587 (TLS)</SelectItem>
                  <SelectItem value="25">25 (不加密)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpUser">用户名</Label>
              <Input
                id="smtpUser"
                placeholder="邮箱地址"
                value={formData.smtpUser}
                onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPass">密码/授权码</Label>
              <div className="relative">
                <Input
                  id="smtpPass"
                  type={showPassword ? "text" : "password"}
                  placeholder="SMTP 密码或授权码"
                  value={formData.smtpPass}
                  onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleVerify}
              disabled={verifyMutation.isLoading || !formData.smtpHost || !formData.smtpUser}
            >
              {verifyMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CheckCircle className="h-4 w-4 mr-2" />
              验证配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 发件人信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">发件人信息</CardTitle>
          <CardDescription>
            设置邮件发送者的显示名称和地址
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromName">发件人名称</Label>
              <Input
                id="fromName"
                placeholder="如: 文章管理工具"
                value={formData.fromName}
                onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fromEmail">发件人邮箱</Label>
              <Input
                id="fromEmail"
                placeholder="通常与用户名相同"
                value={formData.fromEmail}
                onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">通知设置</CardTitle>
          <CardDescription>
            选择何时接收邮件通知
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notifyEmail">接收通知的邮箱</Label>
            <Input
              id="notifyEmail"
              placeholder="接收通知的邮箱地址"
              value={formData.notifyEmail}
              onChange={(e) => setFormData({ ...formData, notifyEmail: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                发布成功时通知
              </Label>
              <Switch
                checked={formData.notifyOnSuccess}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyOnSuccess: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                发布失败时通知
              </Label>
              <Switch
                checked={formData.notifyOnFailed}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyOnFailed: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                登录状态失效时通知
              </Label>
              <Switch
                checked={formData.notifyOnCookieExpired}
                onCheckedChange={(checked) => setFormData({ ...formData, notifyOnCookieExpired: checked })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleSendTest}
              disabled={testMutation.isLoading || !formData.enabled || !formData.notifyEmail}
            >
              {testMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              发送测试邮件
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveMutation.isLoading}>
          {saveMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          保存配置
        </Button>
      </div>
    </div>
  );
}

// 定时任务管理组件
function ScheduleTaskSettings() {
  const { data: pendingTasks, isLoading: pendingLoading } = trpc.schedule.listPending.useQuery();
  const { data: historyData, isLoading: historyLoading } = trpc.schedule.listHistory.useQuery({ page: 1, pageSize: 20 });
  const utils = trpc.useContext();

  const cancelMutation = trpc.schedule.cancel.useMutation({
    onSuccess: () => {
      message.success("任务已取消");
      utils.schedule.listPending.invalidate();
      utils.schedule.listHistory.invalidate();
    },
    onError: (error: Error) => {
      message.error(`取消失败: ${error.message}`);
    },
  });

  const clearHistoryMutation = trpc.schedule.clearHistory.useMutation({
    onSuccess: (data: any) => {
      message.success(`已清空 ${data.deletedCount} 条历史记录`);
      utils.schedule.listHistory.invalidate();
    },
    onError: (error: Error) => {
      message.error(`清空失败: ${error.message}`);
    },
  });

  const formatTime = (time: string | Date) => {
    const date = new Date(time);
    return date.toLocaleString("zh-CN");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />待执行</Badge>;
      case "running":
        return <Badge variant="default"><Loader2 className="h-3 w-3 mr-1 animate-spin" />执行中</Badge>;
      case "success":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />成功</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />失败</Badge>;
      case "cancelled":
        return <Badge variant="outline">已取消</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "tencent":
        return "腾讯云社区";
      case "juejin":
        return "掘金";
      case "csdn":
        return "CSDN";
      default:
        return platform;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">定时任务</h2>
        <p className="text-sm text-muted-foreground">
          管理和查看定时发布任务
        </p>
      </div>

      {/* 待执行任务 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            待执行任务
            {pendingTasks && pendingTasks.length > 0 && (
              <Badge variant="secondary">{pendingTasks.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            即将自动执行的定时发布任务
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingTasks && pendingTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>计划时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTasks.map((task: any) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {task.article?.title || `文章 #${task.articleId}`}
                    </TableCell>
                    <TableCell>{getPlatformName(task.platform)}</TableCell>
                    <TableCell>{formatTime(task.scheduledAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelMutation.mutate({ taskId: task.id })}
                        disabled={cancelMutation.isLoading}
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
              暂无待执行的定时任务
            </div>
          )}
        </CardContent>
      </Card>

      {/* 历史记录 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                历史记录
              </CardTitle>
              <CardDescription>
                已执行的定时任务记录
              </CardDescription>
            </div>
            {historyData && historyData.tasks.filter((t: any) => t.status !== "pending").length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clearHistoryMutation.mutate()}
                disabled={clearHistoryMutation.isLoading}
                className="text-destructive hover:text-destructive"
              >
                {clearHistoryMutation.isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                清空记录
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : historyData && historyData.tasks.filter((t: any) => t.status !== "pending").length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>文章</TableHead>
                  <TableHead>平台</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>执行时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.tasks
                  .filter((task: any) => task.status !== "pending")
                  .map((task: any) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {task.article?.title || `文章 #${task.articleId}`}
                      </TableCell>
                      <TableCell>{getPlatformName(task.platform)}</TableCell>
                      <TableCell>{getStatusBadge(task.status)}</TableCell>
                      <TableCell>
                        {task.executedAt ? formatTime(task.executedAt) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无历史记录
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 用户管理组件（仅超级管理员可见）
function UserManagementSettings() {
  const { data: adminList, isLoading } = trpc.adminUser.list.useQuery();
  const utils = trpc.useContext();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: AdminRole.ADMIN as AdminRole,
  });

  const createMutation = trpc.adminUser.create.useMutation({
    onSuccess: () => {
      message.success("用户创建成功");
      setShowAddDialog(false);
      setFormData({ username: "", password: "", role: AdminRole.ADMIN });
      utils.adminUser.list.invalidate();
    },
    onError: (error: Error) => {
      message.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.adminUser.update.useMutation({
    onSuccess: () => {
      message.success("用户更新成功");
      setShowEditDialog(false);
      setEditingUser(null);
      setFormData({ username: "", password: "", role: AdminRole.ADMIN });
      utils.adminUser.list.invalidate();
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.adminUser.delete.useMutation({
    onSuccess: () => {
      message.success("用户已删除");
      utils.adminUser.list.invalidate();
    },
    onError: (error: Error) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  const handleCreate = () => {
    if (!formData.username.trim()) {
      message.error("请输入用户名");
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      message.error("密码至少6位");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: "",
      role: user.role,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!formData.username.trim()) {
      message.error("请输入用户名");
      return;
    }
    const updateData: any = {
      id: editingUser.id,
      username: formData.username,
      role: formData.role,
    };
    if (formData.password) {
      if (formData.password.length < 6) {
        message.error("密码至少6位");
        return;
      }
      updateData.password = formData.password;
    }
    updateMutation.mutate(updateData);
  };

  const handleDelete = (user: any) => {
    if (user.role === AdminRole.SUPER_ADMIN) {
      message.error("不能删除超级管理员");
      return;
    }
    if (confirm(`确定要删除用户 "${user.username}" 吗？`)) {
      deleteMutation.mutate({ id: user.id });
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === AdminRole.SUPER_ADMIN) {
      return (
        <Badge variant="default" className="bg-purple-500">
          <ShieldCheck className="h-3 w-3 mr-1" />
          超级管理员
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Shield className="h-3 w-3 mr-1" />
        管理员
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">用户管理</h2>
          <p className="text-sm text-muted-foreground">
            管理系统管理员账户
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>添加管理员</DialogTitle>
              <DialogDescription>
                创建一个新的管理员账户
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-username">用户名</Label>
                <Input
                  id="new-username"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="请输入密码（至少6位）"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-role">角色</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as AdminRole })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={AdminRole.ADMIN}>管理员</SelectItem>
                    <SelectItem value={AdminRole.SUPER_ADMIN}>超级管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={createMutation.isLoading}
              >
                {createMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : adminList && adminList.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminList.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("zh-CN")
                        : "从未登录"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(user.createdAt).toLocaleString("zh-CN")}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {user.role !== AdminRole.SUPER_ADMIN && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user)}
                          disabled={deleteMutation.isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">
              暂无用户数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改管理员账户信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">用户名</Label>
              <Input
                id="edit-username"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">新密码</Label>
              <Input
                id="edit-password"
                type="password"
                placeholder="留空则不修改密码"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">留空则保持原密码不变</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">角色</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as AdminRole })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AdminRole.ADMIN}>管理员</SelectItem>
                  <SelectItem value={AdminRole.SUPER_ADMIN}>超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isLoading}
            >
              {updateMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 账号安全组件（修改自己的密码）
function AccountSecuritySettings() {
  const authUser = getAuthUser();
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const changePasswordMutation = trpc.adminAuth.changePassword.useMutation({
    onSuccess: () => {
      message.success("密码修改成功");
      setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    },
    onError: (error: Error) => {
      message.error(`修改失败: ${error.message}`);
    },
  });

  const handleChangePassword = () => {
    if (!formData.oldPassword) {
      message.error("请输入原密码");
      return;
    }
    if (!formData.newPassword || formData.newPassword.length < 6) {
      message.error("新密码至少6位");
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      message.error("两次输入的密码不一致");
      return;
    }
    changePasswordMutation.mutate({
      oldPassword: formData.oldPassword,
      newPassword: formData.newPassword,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">账号安全</h2>
        <p className="text-sm text-muted-foreground">
          管理您的账号安全设置
        </p>
      </div>

      {/* 当前账号信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">当前账号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{authUser?.username}</span>
            {authUser?.role === AdminRole.SUPER_ADMIN ? (
              <Badge variant="default" className="bg-purple-500">
                <ShieldCheck className="h-3 w-3 mr-1" />
                超级管理员
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Shield className="h-3 w-3 mr-1" />
                管理员
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">修改密码</CardTitle>
          <CardDescription>
            定期修改密码可以提高账号安全性
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-password">原密码</Label>
            <div className="relative">
              <Input
                id="old-password"
                type={showOldPassword ? "text" : "password"}
                placeholder="请输入原密码"
                value={formData.oldPassword}
                onChange={(e) => setFormData({ ...formData, oldPassword: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowOldPassword(!showOldPassword)}
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新密码</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? "text" : "password"}
                placeholder="请输入新密码（至少6位）"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">确认新密码</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="请再次输入新密码"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isLoading}
          >
            {changePasswordMutation.isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            修改密码
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// 服务器配置组件
function ServerConfigSettings() {
  const [baseUrl, setBaseUrlState] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // 加载当前配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const url = await getServerBaseUrl();
        setBaseUrlState(url);
      } finally {
        setIsInitialLoading(false);
      }
    };
    loadConfig();
  }, []);

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
          配置云端服务器地址，用于 API 调用
        </p>
      </div>

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
    </div>
  );
}

// 编辑器设置组件
function EditorSettings() {
  const [spellCheckEnabled, setSpellCheckEnabledState] = useState(() => isSpellCheckEnabled());
  const [customWords, setCustomWords] = useState<string[]>(() => getCustomDictionary());

  const handleSpellCheckToggle = (checked: boolean) => {
    setSpellCheckEnabled(checked);
    setSpellCheckEnabledState(checked);
    // 提示用户需要刷新编辑器页面
    if (checked) {
      message.success("拼写检查已启用，编辑器将自动应用");
    } else {
      message.info("拼写检查已关闭");
    }
  };

  const handleRemoveWord = (word: string) => {
    removeFromCustomDictionary(word);
    setCustomWords(getCustomDictionary());
    message.success(`已从单词本移除: ${word}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">编辑器设置</h2>
        <p className="text-sm text-muted-foreground">
          自定义编辑器的行为和功能
        </p>
      </div>

      {/* 拼写检查开关 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              英文拼写检查
            </span>
            <Switch
              checked={spellCheckEnabled}
              onCheckedChange={handleSpellCheckToggle}
            />
          </CardTitle>
          <CardDescription>
            启用后，编辑器将对英文单词进行拼写检查，拼写错误的单词会显示红色波浪下划线
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>功能说明：</p>
          <ul className="list-disc list-inside space-y-1">
            <li>自动检测英文单词拼写错误</li>
            <li>右键点击错误单词可查看修正建议</li>
            <li>支持将常用词添加到自定义单词本</li>
            <li>自动跳过常见技术术语（如 API、React、TypeScript 等）</li>
          </ul>
        </CardContent>
      </Card>

      {/* 自定义单词本 */}
      {customWords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">自定义单词本</CardTitle>
            <CardDescription>
              您添加到单词本的单词不会被标记为拼写错误
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {customWords.map((word) => (
                <Badge
                  key={word}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  {word}
                  <button
                    onClick={() => handleRemoveWord(word)}
                    className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <XCircle className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 关于组件
function AboutSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">关于</h2>
        <p className="text-sm text-muted-foreground">
          应用信息和功能说明
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">PenBridge</CardTitle>
          <CardDescription>版本 1.0.0</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">功能</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• 文章编辑与管理</li>
              <li>• 多平台授权登录</li>
              <li>• 同步草稿到云端</li>
              <li>• 一键发布文章</li>
              <li>• 定时发布功能</li>
              <li>• 邮件通知功能</li>
              <li>• 多用户管理</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const { tab } = useSearch({ from: "/settings" });
  const activeTab = tab || "tencent";

  const handleTabChange = (tabId: string) => {
    navigate({
      to: "/settings",
      search: { tab: tabId as "server" | "tencent" | "juejin" | "email" | "schedule" | "users" | "account" | "editor" | "about" },
      replace: true,
    });
  };

  const menuGroups = getSettingsMenu();

  return (
    <div className="flex h-full">
      {/* 设置侧边菜单 */}
      <div className="w-48 border-r border-border bg-muted/30 shrink-0">
        <div className="p-4">
          <h1 className="text-lg font-semibold">设置</h1>
        </div>
        <nav className="px-2 pb-4 space-y-4">
          {menuGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md transition-colors",
                      activeTab === item.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* 设置内容 */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl">
          {activeTab === "server" && <ServerConfigSettings />}
          {activeTab === "tencent" && <TencentAuthSettings />}
          {activeTab === "juejin" && <JuejinAuthSettings />}
          {activeTab === "email" && <EmailNotificationSettings />}
          {activeTab === "schedule" && <ScheduleTaskSettings />}
          {activeTab === "users" && isSuperAdmin() && <UserManagementSettings />}
          {activeTab === "account" && <AccountSecuritySettings />}
          {activeTab === "editor" && <EditorSettings />}
          {activeTab === "about" && <AboutSettings />}
        </div>
      </ScrollArea>
    </div>
  );
}

// 定义 search params 的验证 schema
const settingsSearchSchema = z.object({
  tab: z.enum(["server", "tencent", "juejin", "email", "schedule", "users", "account", "editor", "about"]).optional().catch("tencent"),
});

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  validateSearch: settingsSearchSchema,
});
