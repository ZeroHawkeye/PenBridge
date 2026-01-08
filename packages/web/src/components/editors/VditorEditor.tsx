// Vditor 编辑器组件 - 支持三种编辑模式：所见即所得(wysiwyg)、即时渲染(ir)、分屏预览(sv)
import {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";
import type { BaseEditorProps, EditorRef, VditorMode } from "./types";
import { getServerBaseUrlSync } from "@/utils/serverConfig";

// 检测是否在 Electron 环境中运行
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};

/**
 * 处理对齐指令语法 (:::center, :::left, :::right, :::justify)
 * 将 Markdown 中的对齐指令转换为带样式的 HTML
 * 
 * 输入格式：
 * :::center
 * 内容
 * :::
 * 
 * 输出格式：
 * <div style="text-align: center">内容</div>
 */
function transformAlignmentDirectives(content: string): string {
  const alignmentNames = ["center", "left", "right", "justify"];
  let result = content;
  
  for (const alignment of alignmentNames) {
    // 匹配容器指令: :::name ... :::
    // 注意：在 HTML 预览中，:::name 可能已经被包裹在 <p> 标签中
    // 所以我们需要处理多种情况
    
    // 情况1：纯文本格式（在 Markdown 源码中）
    const pureTextRegex = new RegExp(
      `:::${alignment}\\s*\\n([\\s\\S]*?)\\n:::`,
      "g"
    );
    
    result = result.replace(pureTextRegex, (_match, innerContent: string) => {
      const trimmedContent = innerContent.trim();
      return `<div style="text-align: ${alignment}">${trimmedContent}</div>`;
    });
    
    // 情况2：被 <p> 标签包裹的格式（在 HTML 预览中）
    // 匹配 <p>:::name</p> ... <p>:::</p> 模式
    const htmlWrappedRegex = new RegExp(
      `<p>:::${alignment}<\\/p>([\\s\\S]*?)<p>:::<\\/p>`,
      "gi"
    );
    
    result = result.replace(htmlWrappedRegex, (_match, innerContent: string) => {
      const trimmedContent = innerContent.trim();
      return `<div class="align-directive align-${alignment}" style="text-align: ${alignment}">${trimmedContent}</div>`;
    });
  }
  
  return result;
}

// 将图片路径转换为正确的完整 URL
function convertImageUrl(url: string): string {
  // 如果是 base64，直接返回
  if (url.startsWith("data:")) {
    return url;
  }
  
  const baseUrl = getServerBaseUrlSync();
  if (!baseUrl) {
    return url;
  }
  
  // 如果是相对路径，拼接服务器地址
  if (url.startsWith("/uploads/")) {
    return `${baseUrl}${url}`;
  }
  
  // 如果是完整 URL，检查是否需要替换为当前 baseUrl
  // 处理 http://localhost:3000/uploads/... 或其他旧地址的情况
  const uploadsMatch = url.match(/https?:\/\/[^/]+?(\/uploads\/[^"'\s)]+)/);
  if (uploadsMatch) {
    return `${baseUrl}${uploadsMatch[1]}`;
  }
  
  return url;
}

// 安全销毁 Vditor 实例的辅助函数
function safeDestroyVditor(vditor: Vditor | null): boolean {
  if (!vditor) return false;
  
  try {
    // 检查 vditor 内部状态是否有效
    const internalVditor = (vditor as any).vditor;
    if (internalVditor && internalVditor.element) {
      vditor.destroy();
      return true;
    }
  } catch (error) {
    console.warn("Vditor destroy error:", error);
  }
  return false;
}

export interface VditorEditorProps extends BaseEditorProps {
  // 编辑器模式
  mode?: VditorMode;
  // 模式变化回调
  onModeChange?: (mode: VditorMode) => void;
}

// Vditor 编辑器组件
function VditorEditorInner(
  {
    value,
    onChange,
    placeholder = "开始写作...",
    readonly = false,
    className = "",
    articleId,
    mode = "ir",
    onModeChange,
  }: VditorEditorProps,
  ref: React.ForwardedRef<EditorRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const isInitializedRef = useRef(false);
  const pendingContentRef = useRef<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 初始化 Vditor
  useEffect(() => {
    if (!containerRef.current || isInitializedRef.current) return;
    isInitializedRef.current = true;

    const baseUrl = getServerBaseUrlSync();
    // 上传 URL 格式：/api/upload/:articleId（路径参数）
    const uploadUrl = articleId
      ? `${baseUrl}/api/upload/${articleId}`
      : `${baseUrl}/api/upload`;

    const vditor = new Vditor(containerRef.current, {
      // 使用本地构建的 vditor 资源（包含修改过的 lute.min.js，支持对齐指令）
      // Electron 使用相对路径（file:// 协议），Web/Docker 使用绝对路径
      cdn: isElectron() ? "./vditor" : "/vditor",
      // 编辑器模式: ir(即时渲染，类似 Typora), wysiwyg(所见即所得), sv(分屏预览)
      mode: mode,
      // 初始内容
      value: value,
      // 占位符
      placeholder: placeholder,
      // 最小高度
      minHeight: 400,
      // 禁用缓存
      cache: {
        enable: false,
      },
      // 工具栏配置
      toolbar: [
        "headings",
        "bold",
        "italic",
        "strike",
        "|",
        "line",
        "quote",
        "list",
        "ordered-list",
        "check",
        "|",
        "code",
        "inline-code",
        "table",
        "link",
        "upload",
        "|",
        "undo",
        "redo",
        "|",
        "outline",
        "fullscreen",
        "|",
        {
          name: "mode-switch",
          tip: "切换模式",
          icon: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>',
          click: () => {
            // 切换模式循环: ir -> wysiwyg -> sv -> ir
            const currentMode = vditor.getCurrentMode() as VditorMode;
            const nextMode: VditorMode =
              currentMode === "ir" ? "wysiwyg" : currentMode === "wysiwyg" ? "sv" : "ir";
            
            // 安全销毁当前实例
            safeDestroyVditor(vditor);
            isInitializedRef.current = false;
            vditorRef.current = null;
            
            // 触发模式变化回调，让父组件重新渲染
            onModeChange?.(nextMode);
          },
        },
      ],
      // 工具栏固定
      toolbarConfig: {
        pin: true,
      },
      // 计数器
      counter: {
        enable: true,
        type: "text",
      },
      // 预览配置
      preview: {
        delay: 300,
        hljs: {
          enable: true,
          lineNumber: true,
          style: "github",
        },
        markdown: {
          autoSpace: true,
          fixTermTypo: true,
          toc: true,
        },
        // 渲染前转换 - 处理图片路径和对齐指令
        transform: (html: string) => {
          let result = html;
          
          // 1. 处理对齐指令语法 (:::center, :::left, :::right, :::justify)
          result = transformAlignmentDirectives(result);
          
          // 2. 处理图片路径
          const serverBaseUrl = getServerBaseUrlSync();
          if (serverBaseUrl) {
            // 将相对路径 src="/uploads/..." 转换为完整 URL
            result = result.replace(
              /src="(\/uploads\/[^"]+)"/g,
              `src="${serverBaseUrl}$1"`
            );
            
            // 将旧的完整 URL（如 http://localhost:3000/uploads/...）替换为当前 baseUrl
            result = result.replace(
              /src="https?:\/\/[^"]*?(\/uploads\/[^"]+)"/g,
              `src="${serverBaseUrl}$1"`
            );
          }
          
          return result;
        },
      },
      // 大纲配置
      outline: {
        enable: true,
        position: "right",
      },
      // 图片预览配置 - 处理相对路径
      image: {
        isPreview: true,
        preview: (bom: Element) => {
          // 处理图片元素的 src 属性，将相对路径转换为完整 URL
          const img = bom as HTMLImageElement;
          if (img.src && !img.src.startsWith("http") && !img.src.startsWith("data:")) {
            const originalSrc = img.getAttribute("src") || "";
            img.src = convertImageUrl(originalSrc);
          }
        },
      },
      // 图片上传配置
      upload: {
        url: uploadUrl,
        fieldName: "file",  // 后端接口使用 "file" 字段名
        max: 10 * 1024 * 1024, // 10MB
        accept: "image/*",
        // 自定义上传处理 - 动态获取 baseUrl 以确保使用正确的服务器地址
        handler: async (files: File[]): Promise<null> => {
          const results: string[] = [];
          
          // 动态获取当前 baseUrl（避免使用闭包中的旧值）
          const currentBaseUrl = getServerBaseUrlSync();
          // 上传 URL 格式：/api/upload/:articleId（路径参数）
          const currentUploadUrl = articleId
            ? `${currentBaseUrl}/api/upload/${articleId}`
            : `${currentBaseUrl}/api/upload`;
          
          for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);  // 后端接口使用 "file" 字段名
            
            try {
              const response = await fetch(currentUploadUrl, {
                method: "POST",
                body: formData,
                headers: {
                  Authorization: `Bearer ${localStorage.getItem("admin_token") || ""}`,
                },
              });
              
              if (!response.ok) {
                throw new Error("上传失败");
              }
              
              const data = await response.json();
              if (data.url) {
                // 将相对路径转换为完整 URL 后再插入
                const fullUrl = convertImageUrl(data.url);
                results.push(`![${file.name}](${fullUrl})`);
              }
            } catch (error) {
              console.error("图片上传失败:", error);
              vditorRef.current?.tip("图片上传失败", 3000);
            }
          }
          
          if (results.length > 0) {
            vditorRef.current?.insertValue(results.join("\n"));
          }
          
          return null;
        },
      },
      // 编辑器就绪回调
      after: () => {
        setIsReady(true);
        vditorRef.current = vditor;
        
        // 如果有待设置的内容，设置它
        if (pendingContentRef.current !== null) {
          vditor.setValue(pendingContentRef.current, true);
          pendingContentRef.current = null;
        }
        
        // 只读模式
        if (readonly) {
          vditor.disabled();
        }
        
        // 处理编辑器中的图片 URL - 将相对路径或旧地址转换为正确的完整 URL
        const container = containerRef.current;
        if (container) {
          const currentBaseUrl = getServerBaseUrlSync();
          const processImages = () => {
            const images = container.querySelectorAll("img");
            images.forEach((img) => {
              // 使用 getAttribute 获取原始属性值，避免浏览器自动解析
              const originalSrc = img.getAttribute("src");
              if (!originalSrc || originalSrc.startsWith("data:")) return;
              
              // 检查是否需要转换：
              // 1. 相对路径 /uploads/...
              // 2. 包含 /uploads/ 但不是当前 baseUrl 的完整 URL
              const isRelativePath = originalSrc.startsWith("/uploads/");
              const isWrongBaseUrl = originalSrc.includes("/uploads/") && 
                currentBaseUrl && 
                !originalSrc.startsWith(currentBaseUrl);
              
              if (isRelativePath || isWrongBaseUrl) {
                const correctUrl = convertImageUrl(originalSrc);
                // 只有当 URL 确实需要更新时才设置
                if (img.src !== correctUrl) {
                  img.src = correctUrl;
                }
              }
            });
          };
          
          // 初始处理
          processImages();
          
          // 监听 DOM 变化，持续处理新添加的图片
          const observer = new MutationObserver((mutations) => {
            // 检查是否有新增的图片节点
            let hasNewImages = false;
            for (const mutation of mutations) {
              if (mutation.type === "childList") {
                for (const node of mutation.addedNodes) {
                  if (node instanceof HTMLImageElement || 
                      (node instanceof HTMLElement && node.querySelector("img"))) {
                    hasNewImages = true;
                    break;
                  }
                }
              }
              if (hasNewImages) break;
            }
            
            if (hasNewImages) {
              // 延迟处理，确保图片元素完全渲染
              requestAnimationFrame(() => {
                processImages();
              });
            }
          });
          
          observer.observe(container, {
            childList: true,
            subtree: true,
          });
          
          // 保存 observer 以便清理
          (container as any).__imageObserver = observer;
        }
      },
      // 内容变化回调
      input: (content: string) => {
        onChange?.(content);
      },
      // 焦点回调
      focus: () => {},
      // 失焦回调
      blur: () => {},
    });

    vditorRef.current = vditor;

    return () => {
      // 清理图片 URL 观察器
      if (containerRef.current && (containerRef.current as any).__imageObserver) {
        (containerRef.current as any).__imageObserver.disconnect();
        delete (containerRef.current as any).__imageObserver;
      }
      // 安全销毁 Vditor 实例
      safeDestroyVditor(vditorRef.current);
      vditorRef.current = null;
      isInitializedRef.current = false;
      setIsReady(false);
    };
  }, [mode]); // mode 变化时重新初始化

  // 暴露给父组件的方法
  useImperativeHandle(
    ref,
    () => ({
      // 设置内容
      setContent: (markdown: string): boolean => {
        if (vditorRef.current && isReady) {
          vditorRef.current.setValue(markdown, true);
          return true;
        }
        // 如果编辑器还未就绪，保存待设置的内容
        pendingContentRef.current = markdown;
        return false;
      },
      // 获取内容
      getContent: (): string => {
        return vditorRef.current?.getValue() ?? value;
      },
      // 聚焦
      focus: () => {
        vditorRef.current?.focus();
      },
      // 滚动到指定行
      scrollToLine: (line: number) => {
        if (!vditorRef.current || !containerRef.current) return;
        
        // Vditor 没有直接的 scrollToLine API
        // 我们需要通过计算行号对应的位置来滚动
        const content = vditorRef.current.getValue();
        const lines = content.split("\n");
        
        if (line < 1 || line > lines.length) return;
        
        // 计算目标行内容，去除 markdown 标题前缀
        const targetLineContent = lines[line - 1];
        // 提取标题纯文本（去除 # 前缀）
        const headingMatch = targetLineContent.match(/^#{1,6}\s+(.+)$/);
        const searchText = headingMatch ? headingMatch[1].trim() : targetLineContent.trim();
        
        if (!searchText) return;
        
        // 尝试在编辑器中找到对应的元素并滚动
        const editorElement = containerRef.current.querySelector(".vditor-ir, .vditor-wysiwyg, .vditor-sv");
        if (editorElement) {
          // 查找包含目标行内容的元素
          const allElements = editorElement.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, pre, blockquote");
          for (const el of allElements) {
            const elText = el.textContent?.trim();
            // 精确匹配或包含匹配
            if (elText === searchText || elText?.includes(searchText)) {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              // 添加高亮效果
              el.classList.add("toc-highlight");
              setTimeout(() => {
                el.classList.remove("toc-highlight");
              }, 2000);
              break;
            }
          }
        }
      },
    }),
    [value, isReady]
  );

  // 监听只读状态变化
  useEffect(() => {
    if (!vditorRef.current || !isReady) return;
    
    if (readonly) {
      vditorRef.current.disabled();
    } else {
      vditorRef.current.enable();
    }
  }, [readonly, isReady]);

  return (
    <div
      ref={containerRef}
      className={`vditor-editor-container ${className}`}
      style={{ minHeight: "400px" }}
    />
  );
}

export const VditorEditor = forwardRef(VditorEditorInner);

export default VditorEditor;
