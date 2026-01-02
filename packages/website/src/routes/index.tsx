import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Upload,
  Clock,
  Settings,
  FileText,
  Zap,
  Shield,
  Sparkles,
  ArrowRight,
  Check,
  MonitorDown,
  Loader2,
  ThumbsUp,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

// 图片预加载 hook
function useImagePreloader(imageSources: string[]) {
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    
    let loadedCount = 0;
    const totalImages = imageSources.length;

    imageSources.forEach((src) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          loadedRef.current = true;
          setImagesLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        if (loadedCount === totalImages) {
          loadedRef.current = true;
          setImagesLoaded(true);
        }
      };
    });
  }, [imageSources]);

  return imagesLoaded;
}

// 动画变体
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const stagger = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// 截图数据
const screenshots = {
  dashboard: {
    src: "/screenshot-dashboard.png",
    title: "仪表盘",
    description: "直观的数据统计与快捷操作",
  },
  editor: {
    src: "/screenshot-editor.png", 
    title: "编辑器",
    description: "沉浸式 Markdown 编辑体验",
  },
  ai: {
    src: "/screenshot-ai-agent.png",
    title: "AI 助手",
    description: "智能 AI 助手，帮你优化文章、生成摘要、翻译内容",
  },
};

// 预加载图片源列表
const screenshotSources = Object.values(screenshots).map(s => s.src);

// 应用截图展示组件
function AppScreenshots() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "editor" | "ai">("dashboard");
  const imagesLoaded = useImagePreloader(screenshotSources);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.6 }}
      className="mt-16 relative"
    >
      {/* 截图切换标签 */}
      <div className="flex justify-center gap-2 mb-6">
        {(Object.keys(screenshots) as Array<keyof typeof screenshots>).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            }`}
          >
            {screenshots[key].title}
          </button>
        ))}
      </div>

      {/* 截图展示区域 */}
      <div className="relative mx-auto max-w-5xl">
        {/* 浏览器窗口装饰 */}
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-card">
          {/* 窗口标题栏 */}
          <div className="h-10 bg-muted/80 border-b border-border/50 flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="px-4 py-1 bg-background/50 rounded-md text-xs text-muted-foreground">
                PenBridge - {screenshots[activeTab].title}
              </div>
            </div>
          </div>
          
          {/* 截图内容 - 使用固定宽高比容器避免抖动 */}
          <div className="relative" style={{ aspectRatio: "16/10" }}>
            {/* 加载占位符 */}
            {!imagesLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            
            {/* 预渲染所有图片，通过透明度切换显示 */}
            {(Object.keys(screenshots) as Array<keyof typeof screenshots>).map((key) => (
              <motion.img
                key={key}
                src={screenshots[key].src}
                alt={screenshots[key].title}
                className="absolute inset-0 w-full h-full object-cover object-top"
                initial={false}
                animate={{ 
                  opacity: activeTab === key && imagesLoaded ? 1 : 0,
                  scale: activeTab === key ? 1 : 0.98
                }}
                transition={{ duration: 0.3 }}
                style={{ pointerEvents: activeTab === key ? "auto" : "none" }}
              />
            ))}
          </div>
        </div>

        {/* 描述文字 */}
        <motion.p 
          key={activeTab + "-desc"}
          className="text-center mt-4 text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {screenshots[activeTab].description}
        </motion.p>
        
        {/* 装饰阴影 */}
        <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-3xl -z-10" />
      </div>
    </motion.div>
  );
}

function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 gradient-bg overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          className="text-center"
          initial="initial"
          animate="animate"
          variants={stagger}
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4" />
            <span>开源免费，专为技术写作者打造</span>
          </motion.div>

          {/* 标题 */}
          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="block">多平台文章</span>
            <span className="block bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
              一键发布
            </span>
          </motion.h1>

          {/* 描述 */}
          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            PenBridge 是一款桌面应用，帮助你管理文章并一键发布到腾讯云开发者社区、掘金等技术平台。
            支持 Markdown 编辑、定时发布、多平台同步。
          </motion.p>

          {/* CTA 按钮 */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="https://github.com/ZeroHawkeye/PenBridge/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
              <MonitorDown className="w-5 h-5" />
              下载应用
            </a>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-border bg-background/50 font-semibold text-lg hover:bg-accent transition-all"
            >
              查看文档
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>

          {/* 平台标签 */}
          <motion.div
            variants={fadeInUp}
            className="mt-12 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground"
          >
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Windows
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              macOS
            </span>
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-500" />
              Linux
            </span>
          </motion.div>
        </motion.div>

{/* 应用截图预览 */}
        <AppScreenshots />
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: FileText,
      title: "沉浸式编辑",
      description: "类 Obsidian 风格的 Markdown 编辑器，专注写作，所见即所得。",
    },
    {
      icon: Upload,
      title: "多平台发布",
      description: "一键发布到腾讯云开发者社区、掘金等技术平台，告别重复操作。",
    },
    {
      icon: Clock,
      title: "定时发布",
      description: "支持设定发布时间，自动在指定时间发布文章，轻松管理内容日历。",
    },
    {
      icon: Settings,
      title: "自动登录",
      description: "首次手动登录后自动保存状态，后续操作无需重复登录。",
    },
    {
      icon: Zap,
      title: "AI 辅助",
      description: "内置 AI 助手，帮助你优化文章、生成摘要、翻译内容。",
    },
    {
      icon: Shield,
      title: "本地优先",
      description: "数据存储在本地，隐私安全有保障。开源透明，代码可审计。",
    },
  ];

  return (
    <section id="features" className="py-24 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            为技术写作者设计
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            PenBridge 提供你所需的一切，让你专注于创作优质内容
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={stagger}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={fadeInUp}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all hover:shadow-lg"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// 平台类型
interface Platform {
  id: string;
  name: string;
  status: "completed" | "planned" | "voting";
  votes: number;
  discussionNumber?: number;
}

// 从 API 获取的功能类型
interface Feature {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: "voting" | "planned" | "completed";
  category: string;
  discussionId: string;
  discussionNumber: number;
  createdAt: string;
}

interface FeaturesResponse {
  features: Feature[];
  totalVotes: number;
  totalParticipants: number;
  source: "static" | "github";
}

// 静态平台数据（备用）
function getStaticPlatforms(): Platform[] {
  return [
    { id: "tencent", name: "腾讯云开发者社区", status: "completed", votes: 0 },
    { id: "juejin", name: "掘金", status: "completed", votes: 0 },
    { id: "csdn", name: "CSDN", status: "voting", votes: 0 },
    { id: "segmentfault", name: "思否", status: "voting", votes: 0 },
    { id: "zhihu", name: "知乎", status: "voting", votes: 0 },
    { id: "cnblogs", name: "博客园", status: "voting", votes: 0 },
  ];
}

function PlatformsSection() {
  const [platforms, setPlatforms] = useState<Platform[]>(getStaticPlatforms());
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"static" | "github">("static");

  useEffect(() => {
    const fetchPlatforms = async () => {
      try {
        const response = await fetch("/api/features");
        if (!response.ok) throw new Error("Failed to fetch");
        
        const data: FeaturesResponse = await response.json();
        
        // 筛选 "平台支持" 分类的功能
        const platformFeatures = data.features.filter(f => f.category === "平台支持");
        
        // 转换为平台数据
        const dynamicPlatforms: Platform[] = platformFeatures.map(f => ({
          id: f.id,
          name: f.title,
          status: f.status,
          votes: f.votes,
          discussionNumber: f.discussionNumber,
        }));

        // 按状态和投票数排序：已完成的在前，然后按投票数降序
        dynamicPlatforms.sort((a, b) => {
          // 已完成的优先
          if (a.status === "completed" && b.status !== "completed") return -1;
          if (a.status !== "completed" && b.status === "completed") return 1;
          // 同状态按投票数降序
          return b.votes - a.votes;
        });

        // 只取前 6 个
        setPlatforms(dynamicPlatforms.slice(0, 6));
        setDataSource(data.source);
      } catch {
        // 使用静态数据
        setPlatforms(getStaticPlatforms());
        setDataSource("static");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlatforms();
  }, []);

  const getStatusText = (status: Platform["status"]) => {
    switch (status) {
      case "completed": return "已支持";
      case "planned": return "已规划";
      case "voting": return "投票中";
    }
  };

  const getStatusColor = (status: Platform["status"]) => {
    switch (status) {
      case "completed": return "text-green-500";
      case "planned": return "text-amber-500";
      case "voting": return "text-blue-500";
    }
  };

  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            支持多个技术平台
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            持续扩展支持的平台，让你的文章触达更多读者
          </p>
        </motion.div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {platforms.map((platform, index) => (
              <motion.div
                key={platform.id}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="p-4 rounded-xl bg-card border border-border text-center hover:border-primary/50 transition-colors"
              >
                <p className="font-medium mb-1">{platform.name}</p>
                <p className={`text-sm ${getStatusColor(platform.status)}`}>
                  {getStatusText(platform.status)}
                </p>
                {platform.status !== "completed" && platform.votes > 0 && dataSource === "github" && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <ThumbsUp className="w-3 h-3" />
                    {platform.votes}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground">
            想要支持更多平台？
            <Link to="/survey" className="text-primary hover:underline ml-1">
              参与功能调研
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-24 gradient-bg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            开始使用 PenBridge
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            免费下载，开源透明，让你的技术写作更高效
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/ZeroHawkeye/PenBridge/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:bg-primary/90 transition-all hover:scale-105 shadow-lg shadow-primary/25"
            >
              <MonitorDown className="w-5 h-5" />
              立即下载
            </a>
            <a
              href="https://github.com/ZeroHawkeye/PenBridge"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-border bg-background/50 font-semibold text-lg hover:bg-accent transition-all"
            >
              查看源码
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function HomePage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <PlatformsSection />
      <CTASection />
    </>
  );
}

export const Route = createFileRoute("/")({
  component: HomePage,
});
