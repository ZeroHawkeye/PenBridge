import { useEffect, useRef, useState } from "react";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { getServerBaseUrlSync } from "../utils/serverConfig";
import { createSpellCheckPlugin } from "./SpellCheckPlugin";
import { isSpellCheckEnabled, SPELL_CHECK_CHANGED_EVENT } from "../utils/spellCheck";

// 所有通用样式（包含所有功能的 CSS）
import "@milkdown/crepe/theme/common/style.css";

// 主题样式
import "@milkdown/crepe/theme/frame.css";

// 上传图片到服务器
async function uploadImageToServer(file: File, articleId: number): Promise<string> {
  const apiBaseUrl = getServerBaseUrlSync();
  if (!apiBaseUrl) {
    throw new Error("服务器未配置");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${apiBaseUrl}/api/upload/${articleId}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "图片上传失败");
  }

  const data = await response.json();
  // 返回完整的图片 URL
  return `${apiBaseUrl}${data.url}`;
}

// 将 base64 转换为 File 对象
function base64ToFile(base64: string, filename: string): File {
  // 提取 MIME 类型和数据
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) {
    throw new Error("无效的 base64 数据");
  }
  
  const mimeType = matches[1];
  const data = matches[2];
  
  // 解码 base64
  const binaryString = atob(data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // 创建 File 对象
  const ext = mimeType.split("/")[1] || "png";
  return new File([bytes], `${filename}.${ext}`, { type: mimeType });
}

// 创建图片上传函数（用于 ImageBlock 配置）
function createUploadHandler(articleId: number) {
  return async function uploadImage(file: File): Promise<string> {
    return uploadImageToServer(file, articleId);
  };
}

// 创建 proxyDomURL 处理器，将 base64 图片上传到服务器
function createProxyDomURL(articleId: number) {
  return async function proxyDomURL(url: string): Promise<string> {
    // 如果是 base64 图片，上传到服务器
    if (url.startsWith("data:image/")) {
      try {
        const file = base64ToFile(url, `paste-${Date.now()}`);
        const uploadedUrl = await uploadImageToServer(file, articleId);
        return uploadedUrl;
      } catch (error) {
        console.error("上传粘贴的图片失败:", error);
        // 上传失败时返回原始 URL
        return url;
      }
    }
    // 其他 URL 直接返回
    return url;
  };
}

interface MilkdownEditorProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readonly?: boolean;
  className?: string;
  articleId?: number; // 文章 ID，用于图片上传目录
  enableSpellCheck?: boolean; // 是否启用拼写检查
}

export function MilkdownEditor({
  value,
  onChange,
  placeholder = "开始写作...",
  readonly = false,
  className = "",
  articleId,
  enableSpellCheck,
}: MilkdownEditorProps) {
  // 如果没有显式传入 enableSpellCheck，则从设置中读取，并监听变更
  const [spellCheckState, setSpellCheckState] = useState(() => isSpellCheckEnabled());
  const shouldEnableSpellCheck = enableSpellCheck ?? spellCheckState;
  
  // 监听拼写检查设置变更事件
  useEffect(() => {
    const handleSpellCheckChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled: boolean }>;
      setSpellCheckState(customEvent.detail.enabled);
    };
    
    window.addEventListener(SPELL_CHECK_CHANGED_EVENT, handleSpellCheckChanged);
    return () => {
      window.removeEventListener(SPELL_CHECK_CHANGED_EVENT, handleSpellCheckChanged);
    };
  }, []);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const lastValueRef = useRef(value);
  // 用于跟踪组件是否已卸载，避免在销毁后访问编辑器上下文
  const isMountedRef = useRef(true);
  // 用于跟踪编辑器是否已成功创建
  const isCreatedRef = useRef(false);

  // 初始化编辑器
  useEffect(() => {
    const container = editorRef.current;
    if (!container) return;

    // 标记组件已挂载，编辑器未创建
    isMountedRef.current = true;
    isCreatedRef.current = false;

    // 清空容器，防止重复渲染
    container.innerHTML = "";

    let crepe: Crepe | null = null;
    let createPromise: Promise<void> | null = null;

    // 使用 requestAnimationFrame 延迟初始化，确保 DOM 完全准备好
    const rafId = requestAnimationFrame(() => {
      if (!isMountedRef.current) return;

      // 构建 featureConfigs
      const featureConfigs: Record<string, unknown> = {
        [Crepe.Feature.Placeholder]: {
          text: placeholder,
          mode: "block",
        },
      };

      // 如果有文章 ID，配置图片上传
      if (articleId) {
        const uploadHandler = createUploadHandler(articleId);
        featureConfigs[Crepe.Feature.ImageBlock] = {
          onUpload: uploadHandler,
          inlineOnUpload: uploadHandler,
          blockOnUpload: uploadHandler,
          proxyDomURL: createProxyDomURL(articleId),
        };
      }

      crepe = new Crepe({
        root: container,
        defaultValue: value,
        features: {
          [Crepe.Feature.Cursor]: true,
          [Crepe.Feature.ListItem]: true,
          [Crepe.Feature.LinkTooltip]: true,
          [Crepe.Feature.ImageBlock]: true,
          [Crepe.Feature.BlockEdit]: true,
          [Crepe.Feature.Placeholder]: true,
          [Crepe.Feature.Toolbar]: true,
          [Crepe.Feature.CodeMirror]: true,
          [Crepe.Feature.Table]: true,
        },
        featureConfigs,
      });

      // 使用 on 方法在创建前注册监听器
      crepe.on((listenerManager) => {
        listenerManager.markdownUpdated((_ctx, markdown, prevMarkdown) => {
          try {
            // 检查组件是否仍然挂载且编辑器已创建，避免在销毁后访问上下文
            if (!isMountedRef.current || !isCreatedRef.current) return;
            if (markdown !== prevMarkdown && markdown !== lastValueRef.current) {
              lastValueRef.current = markdown;
              onChange?.(markdown);
            }
          } catch {
            // 忽略编辑器初始化/销毁过程中的错误
          }
        });
      });

      createPromise = crepe.create().then(() => {
        // 再次检查组件是否仍然挂载
        if (!isMountedRef.current) {
          return;
        }
        isCreatedRef.current = true;
        crepeRef.current = crepe;

        // 设置只读状态
        if (readonly) {
          crepe?.setReadonly(true);
        }

        // 添加拼写检查插件
        if (shouldEnableSpellCheck && crepe) {
          try {
            crepe.editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              const spellCheckPlugin = createSpellCheckPlugin();
              
              // 获取当前状态并添加新插件
              const { state } = view;
              const newState = state.reconfigure({
                plugins: [...state.plugins, spellCheckPlugin],
              });
              view.updateState(newState);
            });
          } catch (err) {
            console.warn("拼写检查插件加载失败:", err);
          }
        }
      }).catch(() => {
        // 静默忽略创建过程中的错误（通常是组件卸载导致的）
      });
    });

    return () => {
      // 取消 RAF
      cancelAnimationFrame(rafId);

      // 先标记组件已卸载，阻止后续的回调访问上下文
      isMountedRef.current = false;
      isCreatedRef.current = false;
      crepeRef.current = null;

      // 如果编辑器已创建，等待创建完成后再销毁
      if (crepe) {
        if (createPromise) {
          createPromise.finally(() => {
            try {
              crepe?.destroy();
            } catch {
              // 忽略销毁时的错误
            }
          });
        } else {
          try {
            crepe.destroy();
          } catch {
            // 忽略销毁时的错误
          }
        }
      }
    };
  }, [articleId, shouldEnableSpellCheck]); // eslint-disable-line react-hooks/exhaustive-deps

  // 处理只读状态变化
  useEffect(() => {
    if (crepeRef.current) {
      crepeRef.current.setReadonly(readonly);
    }
  }, [readonly]);

  return (
    <div
      ref={editorRef}
      className={`milkdown-editor ${className}`}
    />
  );
}

export default MilkdownEditor;
