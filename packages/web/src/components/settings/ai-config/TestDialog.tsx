import { useState } from "react";
import {
  Bot,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/utils/auth";
import { getServerBaseUrl } from "@/utils/serverConfig";
import type { Model, TestResult } from "./types";

interface TestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: Model | null;
  getProviderName: (providerId: number) => string;
}

export function TestDialog({ open, onOpenChange, model, getProviderName }: TestDialogProps) {
  const [testInput, setTestInput] = useState("你好，请简单介绍一下你自己。");
  const [testLoading, setTestLoading] = useState(false);
  const [testStreamContent, setTestStreamContent] = useState("");
  const [testReasoningContent, setTestReasoningContent] = useState("");
  const [isReasoning, setIsReasoning] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const handleSendTestMessage = async () => {
    if (!model || !testInput.trim()) return;
    
    setTestResult(null);
    setTestStreamContent("");
    setTestReasoningContent("");
    setIsReasoning(false);
    setTestLoading(true);

    try {
      const token = getAuthToken();
      if (!token) {
        setTestResult({
          success: false,
          message: "未登录",
        });
        setTestLoading(false);
        return;
      }

      const baseUrl = await getServerBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          providerId: model.providerId,
          modelId: model.modelId,
          message: testInput.trim(),
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("无法读取响应流");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        let fullReasoning = "";
        let currentEvent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            if (trimmedLine.startsWith("event:")) {
              currentEvent = trimmedLine.slice(6).trim();
              continue;
            }
            if (trimmedLine.startsWith("data:")) {
              const dataStr = trimmedLine.slice(5).trim();
              if (!dataStr) continue;

              try {
                const data = JSON.parse(dataStr);

                switch (currentEvent) {
                  case "reasoning_start":
                    setIsReasoning(true);
                    break;
                    
                  case "reasoning":
                    if (data.content) {
                      fullReasoning += data.content;
                      setTestReasoningContent(fullReasoning);
                    }
                    break;
                    
                  case "reasoning_end":
                    setIsReasoning(false);
                    break;
                    
                  case "content":
                    if (data.content) {
                      fullContent += data.content;
                      setTestStreamContent(fullContent);
                    }
                    break;
                    
                  case "done":
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
                    setTestResult({
                      success: false,
                      message: data.error || "未知错误",
                    });
                    break;
                    
                  default:
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
                
                currentEvent = "";
              } catch {
                // 忽略解析错误
              }
            }
          }
        }
      } else {
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

  const handleOpenChange = (open: boolean) => {
    onOpenChange(open);
    if (!open) {
      setTestResult(null);
      setTestStreamContent("");
      setTestReasoningContent("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            测试 AI 对话
          </DialogTitle>
          <DialogDescription>
            {model && (
              <span>
                供应商: {getProviderName(model.providerId)} | 模型: {model.displayName}
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
                  <span>输入 Tokens: {testResult.usage.inputTokens}</span>
                  <span>输出 Tokens: {testResult.usage.outputTokens}</span>
                  <span>总计: {testResult.usage.totalTokens}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
