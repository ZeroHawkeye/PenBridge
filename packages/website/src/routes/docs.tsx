import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Book, ChevronRight, ChevronLeft, ExternalLink } from "lucide-react";
import { useState, Suspense, lazy, useEffect } from "react";
import { cn } from "@/lib/utils";
import { sortedDocsMeta, getDocMeta, getAdjacentDocs } from "@/content/docs";
import { MDXProvider } from "@mdx-js/react";

// 懒加载 MDX 文档
const docComponents = {
  "getting-started": lazy(() => import("@/content/docs/getting-started.mdx")),
  "editor": lazy(() => import("@/content/docs/editor.mdx")),
  "publishing": lazy(() => import("@/content/docs/publishing.mdx")),
  "scheduling": lazy(() => import("@/content/docs/scheduling.mdx")),
  "ai-assistant": lazy(() => import("@/content/docs/ai-assistant.mdx")),
  "settings": lazy(() => import("@/content/docs/settings.mdx")),
  "development": lazy(() => import("@/content/docs/development.mdx")),
} as const;

type DocId = keyof typeof docComponents;

// MDX 组件映射
const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-3xl font-bold mt-0 mb-6 pb-4 border-b border-border" {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-2xl font-bold mt-10 mb-4 scroll-mt-20" {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-xl font-semibold mt-8 mb-3 scroll-mt-20" {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="my-4 leading-relaxed text-foreground/90" {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="my-4 ml-6 list-disc space-y-2" {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="my-4 ml-6 list-decimal space-y-2" {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed" {...props} />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const isExternal = props.href?.startsWith("http");
    return (
      <a
        className="text-primary hover:underline inline-flex items-center gap-1"
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        {...props}
      >
        {props.children}
        {isExternal && <ExternalLink className="w-3 h-3" />}
      </a>
    );
  },
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    // 判断是否是代码块内的 code（有 className）还是行内 code
    if (props.className) {
      return <code {...props} />;
    }
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono text-foreground"
        {...props}
      />
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      className="my-6 p-4 rounded-lg bg-muted overflow-x-auto text-sm"
      {...props}
    />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse" {...props} />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      className="border border-border bg-muted px-4 py-2 text-left font-semibold"
      {...props}
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-border px-4 py-2" {...props} />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="my-6 border-l-4 border-primary pl-4 italic text-muted-foreground"
      {...props}
    />
  ),
  hr: () => <hr className="my-8 border-border" />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
};

// 加载中占位
function DocSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/6" />
      <div className="h-32 bg-muted rounded w-full mt-6" />
    </div>
  );
}

// 文档内容组件
function DocContent({ docId }: { docId: DocId }) {
  const DocComponent = docComponents[docId];
  const { prev, next } = getAdjacentDocs(docId);

  return (
    <div>
      <MDXProvider components={mdxComponents}>
        <Suspense fallback={<DocSkeleton />}>
          <DocComponent />
        </Suspense>
      </MDXProvider>

      {/* 上一篇/下一篇导航 */}
      <div className="mt-12 pt-8 border-t border-border flex items-center justify-between gap-4">
        {prev ? (
          <button
            onClick={() => window.location.hash = `#${prev.id}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <div className="text-left">
              <div className="text-xs uppercase tracking-wide">上一篇</div>
              <div className="font-medium text-foreground">{prev.title}</div>
            </div>
          </button>
        ) : (
          <div />
        )}
        {next ? (
          <button
            onClick={() => window.location.hash = `#${next.id}`}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-right"
          >
            <div>
              <div className="text-xs uppercase tracking-wide">下一篇</div>
              <div className="font-medium text-foreground">{next.title}</div>
            </div>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocId>("getting-started");

  // 监听 hash 变化
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash && hash in docComponents) {
        setActiveSection(hash as DocId);
        // hash 变化时滚动到顶部
        window.scrollTo({ top: 0, behavior: "instant" });
      }
    };
    
    // 初始化时检查 hash
    handleHashChange();
    
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const currentMeta = getDocMeta(activeSection);

  return (
    <div className="min-h-screen pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* 侧边导航 */}
          <motion.aside
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 shrink-0"
          >
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center gap-2 mb-6">
                <Book className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-lg">文档</h2>
              </div>
              <nav className="space-y-1">
                {sortedDocsMeta.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => {
                      setActiveSection(doc.id as DocId);
                      window.location.hash = doc.id;
                      // 切换文档时滚动到顶部
                      window.scrollTo({ top: 0, behavior: "instant" });
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors",
                      activeSection === doc.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <doc.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{doc.title}</span>
                    {activeSection === doc.id && (
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    )}
                  </button>
                ))}
              </nav>

              {/* GitHub 链接 */}
              <div className="mt-8 pt-6 border-t border-border">
                <a
                  href="https://github.com/zerx-lab/PenBridge/tree/main/packages/website/src/content/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  在 GitHub 上编辑
                </a>
              </div>
            </div>
          </motion.aside>

          {/* 文档内容 */}
          <motion.main
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <article className="prose prose-neutral dark:prose-invert max-w-none">
              {/* 文档头部 */}
              {currentMeta && (
                <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border not-prose">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <currentMeta.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{currentMeta.title}</h1>
                    <p className="text-sm text-muted-foreground">{currentMeta.description}</p>
                  </div>
                </div>
              )}

              {/* MDX 内容 */}
              <DocContent docId={activeSection} />
            </article>
          </motion.main>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/docs")({
  component: DocsPage,
});
