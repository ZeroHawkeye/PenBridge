import { useState } from "react";
import { User, Eye, EyeOff, Loader2, Shield, ShieldCheck } from "lucide-react";
import { getAuthUser, AdminRole } from "@/utils/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

// 账号安全组件（修改自己的密码）
export function AccountSecuritySettings() {
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
