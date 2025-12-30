import { useRef, useState } from "react";
import { message } from "antd";
import { Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { convertWordToMarkdown } from "@/utils/wordToMarkdown";

interface ImportWordSettingsProps {
  onImport: (title: string, content: string) => void;
}

/**
 * 导入 Word 文档的设置面板组件
 * 用于在编辑器设置中显示导入功能
 */
export function ImportWordSettings({ onImport }: ImportWordSettingsProps) {
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await convertWordToMarkdown(file);
      onImport(result.title, result.markdown);
      message.success(`已导入: ${result.fileName}`);
    } catch (error) {
      console.error("导入 Word 失败:", error);
      message.error(
        error instanceof Error ? error.message : "导入失败，请重试"
      );
    } finally {
      setIsImporting(false);
      // 重置 input 以允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 触发文件选择
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        导入
      </h3>

      {/* 导入 Word 文档 */}
      <div className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
            <FileText className="h-5 w-5 text-blue-500" />
          </div>
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">导入 Word 文档</Label>
            <p className="text-xs text-muted-foreground">
              支持 .docx 格式，文件名将作为标题
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleImportClick}
          disabled={isImporting}
        >
          <Upload className="h-4 w-4" />
          {isImporting ? "导入中..." : "选择文件"}
        </Button>
        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}

export default ImportWordSettings;
