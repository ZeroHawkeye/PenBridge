import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/utils/trpc";
import { setAuthToken, setAuthUser } from "@/utils/auth";
import { Loader2, PenLine, Settings } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: (data: { token: string; admin: { id: number; username: string; role: string } }) => {
      // 保存 token 和用户信息
      setAuthToken(data.token);
      setAuthUser({
        adminId: data.admin.id,
        username: data.admin.username,
        role: data.admin.role as any,
      });
      // 使用 replace 跳转到首页并刷新（确保 tRPC 客户端使用新 token）
      // 使用完整 URL 避免 hash 路由在刷新前被 TanStack Router 解析导致短暂报错
      const targetUrl = new URL(window.location.href);
      targetUrl.hash = "#/";
      window.location.replace(targetUrl.href);
    },
    onError: (err: Error) => {
      setError(err.message || "登录失败");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }
    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    loginMutation.mutate({ username, password });
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Card className="w-[400px] shadow-lg border-slate-200 bg-white">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <PenLine className="h-10 w-10 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            PenBridge
          </CardTitle>
          <CardDescription className="text-slate-500">
            文章管理与发布工具
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 py-2 rounded border border-red-200">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isLoading}
            >
              {loginMutation.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 修改服务器配置 */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-slate-500 hover:text-slate-700"
              onClick={() => navigate({ to: "/setup", search: { reconfigure: true } })}
            >
              <Settings className="mr-2 h-4 w-4" />
              修改服务器配置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
