import { useState, useEffect } from "react";
import { Type, RotateCcw, PenLine, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { message } from "antd";
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

// 编辑器设置组件
export function EditorSettings() {
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
