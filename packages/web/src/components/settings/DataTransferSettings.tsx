import { useState } from "react";
import {
  FileDown,
  FileUp,
  AlertTriangle,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Download,
  Upload,
  XCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/utils/trpc";
import { message } from "antd";

// 数据导入导出组件
export function DataTransferSettings() {
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
