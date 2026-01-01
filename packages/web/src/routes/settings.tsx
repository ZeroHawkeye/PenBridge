import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { User, Cloud, Info, LogOut, LogIn, RefreshCw, Mail, Calendar, Trash2, Eye, EyeOff, Send, CheckCircle, XCircle, Clock, Loader2, Users, Plus, Pencil, Key, Shield, ShieldCheck, Server, PenLine, Sparkles, Bot, Type, RotateCcw, Download, ExternalLink, Database, Upload, FileDown, FileUp, AlertTriangle, Lock } from "lucide-react";
import { isSuperAdmin, getAuthUser, getAuthToken, AdminRole } from "@/utils/auth";
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
  getAppMode,
  resetAppMode,
} from "@/utils/serverConfig";
import {
  isSpellCheckEnabled,
  setSpellCheckEnabled,
  getCustomDictionary,
  removeFromCustomDictionary,
} from "@/utils/spellCheck";
import {
  getSavedFontFamily,
  setFontFamily,
  resetFontFamily,
  getSystemFonts,
  isLocalFontsApiSupported,
  PRESET_FONTS,
  DEFAULT_FONT_FAMILY,
} from "@/utils/fontSettings";

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
      title: "AI 设置",
      items: [
        { id: "ai", icon: Bot, label: "AI 配置" },
      ],
    },
    {
      title: "系统设置",
      items: [
        { id: "schedule", icon: Calendar, label: "定时任务" },
        { id: "email", icon: Mail, label: "邮件通知" },
        { id: "server", icon: Server, label: "服务器配置" },
        { id: "editor", icon: PenLine, label: "编辑器设置" },
        { id: "data", icon: Database, label: "数据管理" },
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

// 编辑器设置组件
function EditorSettings() {
  const [spellCheckEnabled, setSpellCheckEnabledState] = useState(() => isSpellCheckEnabled());
  const [customWords, setCustomWords] = useState<string[]>(() => getCustomDictionary());
  
  // 字体设置状态
  const [currentFont, setCurrentFont] = useState(() => getSavedFontFamily());
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [loadingSystemFonts, setLoadingSystemFonts] = useState(false);
  const [showSystemFonts, setShowSystemFonts] = useState(false);

  // 加载系统字体
  useEffect(() => {
    if (showSystemFonts && systemFonts.length === 0) {
      setLoadingSystemFonts(true);
      getSystemFonts()
        .then((fonts) => {
          setSystemFonts(fonts);
        })
        .catch((err) => {
          console.error("获取系统字体失败:", err);
        })
        .finally(() => {
          setLoadingSystemFonts(false);
        });
    }
  }, [showSystemFonts, systemFonts.length]);

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

  const handleFontChange = (fontFamily: string) => {
    setFontFamily(fontFamily);
    setCurrentFont(fontFamily);
    message.success("字体已更新");
  };

  const handleResetFont = () => {
    resetFontFamily();
    setCurrentFont(DEFAULT_FONT_FAMILY);
    message.success("已恢复默认字体");
  };

  // 判断当前字体是否为预设字体
  const isPresetFont = PRESET_FONTS.some((f) => f.value === currentFont);
  // 如果不是预设字体，显示为自定义字体
  const currentFontDisplay = isPresetFont
    ? PRESET_FONTS.find((f) => f.value === currentFont)?.name || "系统默认"
    : currentFont.split(",")[0].replace(/"/g, "").trim();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">编辑器设置</h2>
        <p className="text-sm text-muted-foreground">
          自定义编辑器的行为和功能
        </p>
      </div>

      {/* 字体设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4" />
            全局字体
          </CardTitle>
          <CardDescription>
            选择应用的显示字体，更改后立即生效
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前字体预览 */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground mb-2">当前字体预览：</p>
            <p style={{ fontFamily: currentFont }} className="text-lg">
              你好世界 Hello World 1234567890
            </p>
            <p style={{ fontFamily: currentFont }} className="text-sm text-muted-foreground mt-1">
              当前使用：{currentFontDisplay}
            </p>
          </div>

          {/* 预设字体选择 */}
          <div className="space-y-2">
            <Label>预设字体</Label>
            <Select
              value={isPresetFont ? currentFont : ""}
              onValueChange={handleFontChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择预设字体" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_FONTS.map((font) => (
                  <SelectItem key={font.name} value={font.value}>
                    <span style={{ fontFamily: font.value }}>{font.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 系统字体选择（需要浏览器支持 Local Fonts API） */}
          {isLocalFontsApiSupported() && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>系统字体</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSystemFonts(!showSystemFonts)}
                >
                  {showSystemFonts ? "收起" : "展开更多系统字体"}
                </Button>
              </div>
              
              {showSystemFonts && (
                <div className="border rounded-lg p-3 max-h-60 overflow-y-auto">
                  {loadingSystemFonts ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">正在加载系统字体...</span>
                    </div>
                  ) : systemFonts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      无法获取系统字体，请授权访问或使用预设字体
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {systemFonts.map((fontName) => (
                        <Button
                          key={fontName}
                          variant={currentFont.includes(fontName) ? "secondary" : "ghost"}
                          size="sm"
                          className="justify-start text-left truncate"
                          style={{ fontFamily: fontName }}
                          onClick={() => handleFontChange(`"${fontName}", sans-serif`)}
                        >
                          {fontName}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 重置按钮 */}
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFont}
              disabled={currentFont === DEFAULT_FONT_FAMILY}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              恢复默认字体
            </Button>
          </div>
        </CardContent>
      </Card>

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

// AI 配置组件
function AIConfigSettings() {
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
                          Max Tokens
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

                    {/* AI Loop 配置 */}
                    <div className="space-y-2 p-3 rounded-md bg-muted/50">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="ailoop-maxcount" className="text-sm font-normal">
                          AI Loop 最大循环次数
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="ailoop-maxcount"
                          type="number"
                          min="1"
                          max="100"
                          value={modelForm.capabilities.aiLoop.maxLoopCount}
                          onChange={(e) => setModelForm({
                            ...modelForm,
                            capabilities: {
                              ...modelForm.capabilities,
                              aiLoop: { maxLoopCount: parseInt(e.target.value) || 20 },
                            },
                          })}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">
                          (1-100, 防止死循环)
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        AI 在对话中可以连续执行工具调用的最大次数，用于 Agent 式多步任务
                      </p>
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

// 数据导入导出组件
function DataTransferSettings() {
  const utils = trpc.useContext();
  
  // 导出配置状态
  const [exportOptions, setExportOptions] = useState({
    includeArticles: true,
    includeFolders: true,
    includeUsers: true,
    includeAdminUsers: false,
    includeAIProviders: true,
    includeEmailConfig: true,
    includeScheduledTasks: true,
    includeImages: true,
    includeSensitiveData: false,
    encryptionPassword: "",
  });
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 导入配置状态
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importOptions, setImportOptions] = useState({
    decryptionPassword: "",
    overwriteExisting: false,
  });
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    version: string;
    exportedAt: string;
    isEncrypted: boolean;
    counts: {
      users: number;
      adminUsers: number;
      folders: number;
      articles: number;
      aiProviders: number;
      aiModels: number;
      emailConfig: boolean;
      scheduledTasks: number;
      images: number;
    };
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: {
      users: number;
      adminUsers: number;
      folders: number;
      articles: number;
      aiProviders: number;
      aiModels: number;
      emailConfig: boolean;
      scheduledTasks: number;
      images: number;
    };
    skipped: {
      users: number;
      adminUsers: number;
      folders: number;
      articles: number;
      aiProviders: number;
      aiModels: number;
      scheduledTasks: number;
      images: number;
    };
    errors: string[];
  } | null>(null);

  // 导出数据 mutation
  const exportMutation = trpc.dataTransfer.export.useMutation({
    onSuccess: (data: any) => {
      // 将 base64 转换为 Blob 并下载为 ZIP 文件
      const binaryString = atob(data.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `penbridge-backup-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success("数据导出成功");
    },
    onError: (error: Error) => {
      message.error(`导出失败: ${error.message}`);
    },
  });

  // 预览导入数据 mutation
  const previewMutation = trpc.dataTransfer.preview.useMutation({
    onSuccess: (data: any) => {
      // 适配新的返回格式
      setPreviewData({
        version: data.stats.version,
        exportedAt: data.stats.exportedAt,
        isEncrypted: data.stats.encrypted,
        counts: {
          users: data.stats.counts?.users || 0,
          adminUsers: data.stats.counts?.adminUsers || 0,
          folders: data.stats.counts?.folders || 0,
          articles: data.stats.counts?.articles || 0,
          aiProviders: data.stats.counts?.aiProviders || 0,
          aiModels: data.stats.counts?.aiModels || 0,
          emailConfig: (data.stats.counts?.emailConfigs || 0) > 0,
          scheduledTasks: data.stats.counts?.scheduledTasks || 0,
          images: data.stats.counts?.images || 0,
        },
      });
    },
    onError: (error: Error) => {
      message.error(`预览失败: ${error.message}`);
      setPreviewData(null);
    },
  });

  // 导入数据 mutation
  const importMutation = trpc.dataTransfer.import.useMutation({
    onSuccess: (data: any) => {
      // 适配新的返回格式
      setImportResult({
        success: data.success,
        imported: {
          users: data.stats?.users?.imported || 0,
          adminUsers: data.stats?.adminUsers?.imported || 0,
          folders: data.stats?.folders?.imported || 0,
          articles: data.stats?.articles?.imported || 0,
          aiProviders: data.stats?.aiProviders?.imported || 0,
          aiModels: data.stats?.aiModels?.imported || 0,
          emailConfig: (data.stats?.emailConfigs?.imported || 0) > 0,
          scheduledTasks: data.stats?.scheduledTasks?.imported || 0,
          images: data.stats?.images?.imported || 0,
        },
        skipped: {
          users: data.stats?.users?.skipped || 0,
          adminUsers: data.stats?.adminUsers?.skipped || 0,
          folders: data.stats?.folders?.skipped || 0,
          articles: data.stats?.articles?.skipped || 0,
          aiProviders: data.stats?.aiProviders?.skipped || 0,
          aiModels: data.stats?.aiModels?.skipped || 0,
          scheduledTasks: data.stats?.scheduledTasks?.skipped || 0,
          images: data.stats?.images?.skipped || 0,
        },
        errors: data.errors || [],
      });
      if (data.success) {
        message.success("数据导入成功");
        // 刷新相关数据
        utils.invalidate();
      } else {
        message.warning("数据导入部分完成，请查看详情");
      }
    },
    onError: (error: Error) => {
      message.error(`导入失败: ${error.message}`);
    },
  });

  // 处理导出
  const handleExport = () => {
    setIsExporting(true);
    exportMutation.mutate({
      includeArticles: exportOptions.includeArticles,
      includeFolders: exportOptions.includeFolders,
      includeUsers: exportOptions.includeUsers,
      includeAdminUsers: exportOptions.includeAdminUsers,
      includeAIConfig: exportOptions.includeAIProviders,
      includeEmailConfig: exportOptions.includeEmailConfig,
      includeScheduledTasks: exportOptions.includeScheduledTasks,
      includeImages: exportOptions.includeImages,
      includeSensitiveData: exportOptions.includeSensitiveData,
      encryptionPassword: exportOptions.encryptionPassword || undefined,
    }, {
      onSettled: () => setIsExporting(false),
    });
  };

  // 处理文件选择（读取 ZIP 文件）
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportResult(null);
    setIsPreviewing(true);

    try {
      // 读取文件为 ArrayBuffer 并转换为 base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      previewMutation.mutate({ zipData: base64Data }, {
        onSettled: () => setIsPreviewing(false),
      });
    } catch {
      message.error("无法读取文件");
      setIsPreviewing(false);
    }
  };

  // 处理导入（发送 ZIP 数据）
  const handleImport = async () => {
    if (!importFile) {
      message.error("请先选择要导入的文件");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // 读取文件为 ArrayBuffer 并转换为 base64
      const arrayBuffer = await importFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      importMutation.mutate({
        zipData: base64Data,
        decryptionPassword: importOptions.decryptionPassword || undefined,
        overwriteExisting: importOptions.overwriteExisting,
      }, {
        onSettled: () => setIsImporting(false),
      });
    } catch {
      message.error("无法读取文件");
      setIsImporting(false);
    }
  };

  // 重置导入状态
  const handleResetImport = () => {
    setImportFile(null);
    setPreviewData(null);
    setImportResult(null);
    setImportOptions({
      decryptionPassword: "",
      overwriteExisting: false,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">数据管理</h2>
        <p className="text-sm text-muted-foreground">
          导出和导入应用数据，用于备份或迁移到其他设备
        </p>
      </div>

      {/* 数据导出 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-4 w-4" />
            数据导出
          </CardTitle>
        <CardDescription>
          将应用数据导出为 ZIP 压缩包，包含数据库和图片文件
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 导出选项 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">选择导出内容</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-articles" className="text-sm font-normal cursor-pointer">
                  文章数据
                </Label>
                <Switch
                  id="export-articles"
                  checked={exportOptions.includeArticles}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeArticles: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-folders" className="text-sm font-normal cursor-pointer">
                  文件夹结构
                </Label>
                <Switch
                  id="export-folders"
                  checked={exportOptions.includeFolders}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeFolders: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-users" className="text-sm font-normal cursor-pointer">
                  平台登录信息
                </Label>
                <Switch
                  id="export-users"
                  checked={exportOptions.includeUsers}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeUsers: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-admin" className="text-sm font-normal cursor-pointer">
                  管理员账户
                </Label>
                <Switch
                  id="export-admin"
                  checked={exportOptions.includeAdminUsers}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeAdminUsers: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-ai" className="text-sm font-normal cursor-pointer">
                  AI 配置
                </Label>
                <Switch
                  id="export-ai"
                  checked={exportOptions.includeAIProviders}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeAIProviders: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-email" className="text-sm font-normal cursor-pointer">
                  邮件配置
                </Label>
                <Switch
                  id="export-email"
                  checked={exportOptions.includeEmailConfig}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeEmailConfig: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-tasks" className="text-sm font-normal cursor-pointer">
                  定时任务
                </Label>
                <Switch
                  id="export-tasks"
                  checked={exportOptions.includeScheduledTasks}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeScheduledTasks: checked })}
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                <Label htmlFor="export-images" className="text-sm font-normal cursor-pointer">
                  文章图片
                </Label>
                <Switch
                  id="export-images"
                  checked={exportOptions.includeImages}
                  onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeImages: checked })}
                />
              </div>
            </div>
          </div>

          {/* 敏感数据选项 */}
          <div className="p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <Label htmlFor="export-sensitive" className="text-sm font-medium text-amber-700 dark:text-amber-400 cursor-pointer">
                  包含敏感数据
                </Label>
              </div>
              <Switch
                id="export-sensitive"
                checked={exportOptions.includeSensitiveData}
                onCheckedChange={(checked) => setExportOptions({ ...exportOptions, includeSensitiveData: checked })}
              />
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              包含登录凭证、API Key 等敏感信息。建议设置加密密码保护。
            </p>
          </div>

          {/* 加密密码 */}
          {exportOptions.includeSensitiveData && (
            <div className="space-y-2">
              <Label htmlFor="export-password" className="flex items-center gap-2">
                <Lock className="h-3 w-3" />
                加密密码（可选）
              </Label>
              <div className="relative">
                <Input
                  id="export-password"
                  type={showExportPassword ? "text" : "password"}
                  placeholder="设置密码保护导出文件"
                  value={exportOptions.encryptionPassword}
                  onChange={(e) => setExportOptions({ ...exportOptions, encryptionPassword: e.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowExportPassword(!showExportPassword)}
                >
                  {showExportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                设置密码后，敏感数据将使用 AES-256 加密。导入时需要输入相同密码。
              </p>
            </div>
          )}

          {/* 导出按钮 */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              导出数据
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据导入 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            数据导入
          </CardTitle>
        <CardDescription>
          从 ZIP 备份文件导入数据
        </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 文件选择 */}
          <div className="space-y-2">
            <Label htmlFor="import-file">选择备份文件 (.zip)</Label>
            <div className="flex gap-2">
              <Input
                id="import-file"
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="flex-1"
              />
              {importFile && (
                <Button variant="outline" size="icon" onClick={handleResetImport}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* 预览信息 */}
          {isPreviewing && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">正在解析文件...</span>
            </div>
          )}

          {previewData && (
            <div className="p-4 rounded-md border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">备份文件信息</span>
                <Badge variant="outline">v{previewData.version}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                导出时间: {new Date(previewData.exportedAt).toLocaleString("zh-CN")}
              </div>
              {previewData.isEncrypted && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" />
                  <span className="text-xs">此备份包含加密的敏感数据</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {previewData.counts.users > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">平台账户:</span>
                    <span>{previewData.counts.users}</span>
                  </div>
                )}
                {previewData.counts.adminUsers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">管理员:</span>
                    <span>{previewData.counts.adminUsers}</span>
                  </div>
                )}
                {previewData.counts.folders > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">文件夹:</span>
                    <span>{previewData.counts.folders}</span>
                  </div>
                )}
                {previewData.counts.articles > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">文章:</span>
                    <span>{previewData.counts.articles}</span>
                  </div>
                )}
                {previewData.counts.aiProviders > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI 供应商:</span>
                    <span>{previewData.counts.aiProviders}</span>
                  </div>
                )}
                {previewData.counts.aiModels > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">AI 模型:</span>
                    <span>{previewData.counts.aiModels}</span>
                  </div>
                )}
                {previewData.counts.emailConfig && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">邮件配置:</span>
                    <span>有</span>
                  </div>
                )}
                {previewData.counts.scheduledTasks > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">定时任务:</span>
                    <span>{previewData.counts.scheduledTasks}</span>
                  </div>
                )}
                {previewData.counts.images > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">文章图片:</span>
                    <span>{previewData.counts.images}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 导入选项 */}
          {previewData && (
            <div className="space-y-3">
              {/* 解密密码 */}
              {previewData.isEncrypted && (
                <div className="space-y-2">
                  <Label htmlFor="import-password" className="flex items-center gap-2">
                    <Lock className="h-3 w-3" />
                    解密密码
                  </Label>
                  <div className="relative">
                    <Input
                      id="import-password"
                      type={showImportPassword ? "text" : "password"}
                      placeholder="输入备份文件的加密密码"
                      value={importOptions.decryptionPassword}
                      onChange={(e) => setImportOptions({ ...importOptions, decryptionPassword: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowImportPassword(!showImportPassword)}
                    >
                      {showImportPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* 覆盖选项 */}
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div>
                  <Label htmlFor="import-overwrite" className="text-sm font-medium cursor-pointer">
                    覆盖现有数据
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    如果存在相同的数据（如同名文章），是否覆盖
                  </p>
                </div>
                <Switch
                  id="import-overwrite"
                  checked={importOptions.overwriteExisting}
                  onCheckedChange={(checked) => setImportOptions({ ...importOptions, overwriteExisting: checked })}
                />
              </div>
            </div>
          )}

          {/* 导入结果 */}
          {importResult && (
            <div className={cn(
              "p-4 rounded-md border space-y-3",
              importResult.success
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
            )}>
              <div className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                )}
                <span className="font-medium">
                  {importResult.success ? "导入完成" : "导入部分完成"}
                </span>
              </div>

              {/* 导入统计 */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {importResult.imported.users > 0 && (
                  <div className="flex justify-between">
                    <span>导入平台账户:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.users}</span>
                  </div>
                )}
                {importResult.imported.adminUsers > 0 && (
                  <div className="flex justify-between">
                    <span>导入管理员:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.adminUsers}</span>
                  </div>
                )}
                {importResult.imported.folders > 0 && (
                  <div className="flex justify-between">
                    <span>导入文件夹:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.folders}</span>
                  </div>
                )}
                {importResult.imported.articles > 0 && (
                  <div className="flex justify-between">
                    <span>导入文章:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.articles}</span>
                  </div>
                )}
                {importResult.imported.aiProviders > 0 && (
                  <div className="flex justify-between">
                    <span>导入 AI 供应商:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.aiProviders}</span>
                  </div>
                )}
                {importResult.imported.aiModels > 0 && (
                  <div className="flex justify-between">
                    <span>导入 AI 模型:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.aiModels}</span>
                  </div>
                )}
                {importResult.imported.emailConfig && (
                  <div className="flex justify-between">
                    <span>导入邮件配置:</span>
                    <span className="text-green-600 dark:text-green-400">是</span>
                  </div>
                )}
                {importResult.imported.scheduledTasks > 0 && (
                  <div className="flex justify-between">
                    <span>导入定时任务:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.scheduledTasks}</span>
                  </div>
                )}
                {importResult.imported.images > 0 && (
                  <div className="flex justify-between">
                    <span>导入文章图片:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.imported.images}</span>
                  </div>
                )}
              </div>

              {/* 跳过统计 */}
              {(importResult.skipped.users > 0 ||
                importResult.skipped.adminUsers > 0 ||
                importResult.skipped.folders > 0 ||
                importResult.skipped.articles > 0 ||
                importResult.skipped.aiProviders > 0 ||
                importResult.skipped.aiModels > 0 ||
                importResult.skipped.scheduledTasks > 0 ||
                importResult.skipped.images > 0) && (
                <div className="pt-2 border-t border-amber-200 dark:border-amber-700">
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">跳过的数据（已存在）:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    {importResult.skipped.users > 0 && <span>平台账户: {importResult.skipped.users}</span>}
                    {importResult.skipped.adminUsers > 0 && <span>管理员: {importResult.skipped.adminUsers}</span>}
                    {importResult.skipped.folders > 0 && <span>文件夹: {importResult.skipped.folders}</span>}
                    {importResult.skipped.articles > 0 && <span>文章: {importResult.skipped.articles}</span>}
                    {importResult.skipped.aiProviders > 0 && <span>AI 供应商: {importResult.skipped.aiProviders}</span>}
                    {importResult.skipped.aiModels > 0 && <span>AI 模型: {importResult.skipped.aiModels}</span>}
                    {importResult.skipped.scheduledTasks > 0 && <span>定时任务: {importResult.skipped.scheduledTasks}</span>}
                    {importResult.skipped.images > 0 && <span>图片: {importResult.skipped.images}</span>}
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {importResult.errors.length > 0 && (
                <div className="pt-2 border-t border-red-200 dark:border-red-700">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1">错误信息:</p>
                  <ul className="text-xs text-red-500 space-y-1">
                    {importResult.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li>...还有 {importResult.errors.length - 5} 个错误</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 导入按钮 */}
          {previewData && !importResult && (
            <div className="flex justify-end pt-2">
              <Button onClick={handleImport} disabled={isImporting || (previewData.isEncrypted && !importOptions.decryptionPassword)}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                开始导入
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 注意事项 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">注意事项</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• 导出的文件包含应用的配置和数据，请妥善保管</p>
          <p>• 包含敏感数据的备份文件建议设置加密密码保护</p>
          <p>• 导入时会根据唯一标识匹配已存在的数据，可选择跳过或覆盖</p>
          <p>• AI Chat 历史记录不会被导出，仅导出配置信息</p>
          <p>• 建议在导入前先导出当前数据作为备份</p>
        </CardContent>
      </Card>
    </div>
  );
}

// GitHub Release 页面地址
const GITHUB_RELEASES_URL = "https://github.com/ZeroHawkeye/PenBridge/releases";
const GITHUB_REPO_URL = "https://github.com/ZeroHawkeye/PenBridge";

// 更新状态类型
interface UpdateStatusType {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
  progress: number;
  version: string | null;
  releaseNotes: string | null;
}

// 关于组件
function AboutSettings() {
  const [currentVersion, setCurrentVersion] = useState<string>("1.0.0");
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusType | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // 获取当前版本和更新状态（仅 Electron 环境）
  useEffect(() => {
    if (!isElectron()) return;

    // 获取当前版本
    window.electronAPI!.updater.getVersion().then(setCurrentVersion);

    // 获取当前更新状态
    window.electronAPI!.updater.getStatus().then(setUpdateStatus);

    // 监听更新状态变化
    const unsubscribe = window.electronAPI!.updater.onStatusChange((status) => {
      setUpdateStatus(status);
      if (!status.checking) {
        setIsCheckingUpdate(false);
      }
    });

    return unsubscribe;
  }, []);

  // 检查更新
  const handleCheckUpdate = async () => {
    if (!isElectron()) return;
    setIsCheckingUpdate(true);
    try {
      await window.electronAPI!.updater.check();
    } catch (error) {
      console.error("检查更新失败:", error);
      setIsCheckingUpdate(false);
    }
  };

  // 下载更新
  const handleDownloadUpdate = async () => {
    if (!isElectron()) return;
    await window.electronAPI!.updater.download();
  };

  // 安装更新
  const handleInstallUpdate = () => {
    if (!isElectron()) return;
    window.electronAPI!.updater.install();
  };

  // 打开 GitHub Releases
  const handleOpenReleases = () => {
    if (isElectron()) {
      window.electronAPI!.shell.openExternal(GITHUB_RELEASES_URL);
    } else {
      window.open(GITHUB_RELEASES_URL, "_blank");
    }
  };

  // 打开 GitHub 仓库
  const handleOpenRepo = () => {
    if (isElectron()) {
      window.electronAPI!.shell.openExternal(GITHUB_REPO_URL);
    } else {
      window.open(GITHUB_REPO_URL, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">关于</h2>
        <p className="text-sm text-muted-foreground">
          应用信息和功能说明
        </p>
      </div>

      {/* 版本信息卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            PenBridge
          </CardTitle>
          <CardDescription>
            多平台文章管理与发布工具
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 当前版本 */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">当前版本</p>
              <p className="text-2xl font-bold text-primary">{currentVersion}</p>
            </div>
            {isElectron() && (
              <Button
                variant="outline"
                onClick={handleCheckUpdate}
                disabled={isCheckingUpdate || updateStatus?.downloading}
              >
                {isCheckingUpdate || updateStatus?.checking ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    检查中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    检查更新
                  </>
                )}
              </Button>
            )}
          </div>

          {/* 更新状态显示（仅 Electron） */}
          {isElectron() && updateStatus && (
            <>
              {/* 有新版本可用 */}
              {updateStatus.available && !updateStatus.downloaded && !updateStatus.downloading && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Download className="h-5 w-5 text-primary" />
                        <span className="font-medium">发现新版本</span>
                        <Badge className="bg-primary">{updateStatus.version}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        新版本已发布，点击下载更新
                      </p>
                    </div>
                    <Button onClick={handleDownloadUpdate}>
                      <Download className="h-4 w-4 mr-2" />
                      下载更新
                    </Button>
                  </div>
                </div>
              )}

              {/* 下载中 */}
              {updateStatus.downloading && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-medium">正在下载更新...</span>
                    <span className="text-sm text-muted-foreground">
                      {updateStatus.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted-foreground/20 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${updateStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 下载完成，等待安装 */}
              {updateStatus.downloaded && (
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="font-medium text-green-700 dark:text-green-400">
                        更新已下载完成
                      </span>
                    </div>
                    <Button onClick={handleInstallUpdate} className="bg-green-600 hover:bg-green-700">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      立即重启更新
                    </Button>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    点击"立即重启更新"将关闭应用并安装新版本
                  </p>
                </div>
              )}

              {/* 错误状态 */}
              {updateStatus.error && (
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium text-red-700 dark:text-red-400">
                      更新检查失败
                    </span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {updateStatus.error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleOpenReleases}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    前往 GitHub 手动下载
                  </Button>
                </div>
              )}

              {/* 已是最新版本 */}
              {!updateStatus.available && !updateStatus.checking && !updateStatus.error && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  当前已是最新版本
                </div>
              )}
            </>
          )}

          {/* Web 端提示 */}
          {!isElectron() && (
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">您正在使用 Web 版本</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                推荐使用桌面客户端以获得完整功能体验，包括自动更新、平台登录授权等功能。
              </p>
              <Button variant="outline" size="sm" onClick={handleOpenReleases}>
                <Download className="h-4 w-4 mr-2" />
                下载桌面客户端
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 功能介绍 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">功能介绍</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>Markdown 文章编辑与管理</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>多平台授权登录（腾讯云社区、掘金等）</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>一键发布到多个平台</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>定时发布功能</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>邮件通知功能</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>AI 写作辅助</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
              <span>多用户管理</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 开源信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">开源项目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            PenBridge 是一个开源项目，欢迎贡献代码和提交问题反馈。
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenRepo}>
              <ExternalLink className="h-4 w-4 mr-2" />
              GitHub 仓库
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenReleases}>
              <Download className="h-4 w-4 mr-2" />
              版本发布
            </Button>
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
      search: { tab: tabId as "server" | "tencent" | "juejin" | "email" | "schedule" | "users" | "account" | "editor" | "about" | "ai" | "data" },
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
          {activeTab === "ai" && <AIConfigSettings />}
          {activeTab === "data" && <DataTransferSettings />}
          {activeTab === "about" && <AboutSettings />}
        </div>
      </ScrollArea>
    </div>
  );
}

// 定义 search params 的验证 schema
const settingsSearchSchema = z.object({
  tab: z.enum(["server", "tencent", "juejin", "email", "schedule", "users", "account", "editor", "about", "ai", "data"]).optional().catch("tencent"),
});

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  validateSearch: settingsSearchSchema,
});
