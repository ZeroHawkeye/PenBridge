import { useState, useEffect } from "react";
import { Mail, Eye, EyeOff, Send, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

// 邮件通知设置组件
export function EmailNotificationSettings() {
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
