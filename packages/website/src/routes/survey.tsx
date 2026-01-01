import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Vote,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  Circle,
  Sparkles,
  Users,
  Loader2,
  ExternalLink,
  RefreshCw,
  LogIn,
  LogOut,
  Github,
  X,
  Send,
  Plus,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

// 用户信息类型
interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name: string | null;
}

// 认证数据类型
interface AuthData {
  token: string;
  user: GitHubUser;
}

// 功能类型
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

// API 响应类型
interface FeaturesResponse {
  features: Feature[];
  totalVotes: number;
  totalParticipants: number;
  source: "static" | "github";
}

const statusConfig = {
  voting: {
    label: "投票中",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    icon: Vote,
  },
  planned: {
    label: "已规划",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    icon: TrendingUp,
  },
  completed: {
    label: "已完成",
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    icon: CheckCircle2,
  },
};

// GitHub Discussions URL
const DISCUSSIONS_URL = "https://github.com/ZeroHawkeye/PenBridge/discussions";

function SurveyPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [dataSource, setDataSource] = useState<"static" | "github">("static");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // 用户认证状态
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  
  // 投票状态
  const [votedItems, setVotedItems] = useState<Set<string>>(new Set());
  const [votingItem, setVotingItem] = useState<string | null>(null);
  
  // 提交建议弹窗
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDescription, setSuggestDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [filter, setFilter] = useState<"all" | "voting" | "planned" | "completed">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // 从 URL hash 或 localStorage 恢复登录状态
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 检查 URL hash 中的认证数据（OAuth 回调）
    const hash = window.location.hash;
    if (hash.startsWith("#auth=")) {
      try {
        const encodedData = hash.substring(6);
        const authData: AuthData = JSON.parse(atob(encodedData));
        setUser(authData.user);
        setUserToken(authData.token);
        localStorage.setItem("penbridge-auth", JSON.stringify(authData));
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("Failed to parse auth data:", e);
      }
    } else {
      const saved = localStorage.getItem("penbridge-auth");
      if (saved) {
        try {
          const authData: AuthData = JSON.parse(saved);
          setUser(authData.user);
          setUserToken(authData.token);
        } catch {
          localStorage.removeItem("penbridge-auth");
        }
      }
    }

    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setError(`登录失败: ${errorParam}`);
      window.history.replaceState(null, "", window.location.pathname);
    }

    const savedVotes = localStorage.getItem("penbridge-votes");
    if (savedVotes) {
      setVotedItems(new Set(JSON.parse(savedVotes)));
    }
  }, []);

  // 获取功能列表
  const fetchFeatures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch("/api/features");
      if (!response.ok) {
        throw new Error("Failed to fetch features");
      }
      const data: FeaturesResponse = await response.json();
      setFeatures(data.features);
      setTotalVotes(data.totalVotes);
      setTotalParticipants(data.totalParticipants);
      setDataSource(data.source);
    } catch {
      const staticData = getStaticFeatures();
      setFeatures(staticData.features);
      setTotalVotes(staticData.totalVotes);
      setTotalParticipants(staticData.totalParticipants);
      setDataSource("static");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("penbridge-votes", JSON.stringify([...votedItems]));
    }
  }, [votedItems]);

  // 自动清除成功消息
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const categories = [...new Set(features.map((f) => f.category))];

  const filteredFeatures = features
    .filter((f) => filter === "all" || f.status === filter)
    .filter((f) => categoryFilter === "all" || f.category === categoryFilter)
    .sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return b.votes - a.votes;
    });

  const handleLogin = () => {
    window.location.href = "/api/auth/github";
  };

  const handleLogout = () => {
    setUser(null);
    setUserToken(null);
    localStorage.removeItem("penbridge-auth");
  };

  // 投票处理
  const handleVote = async (featureId: string) => {
    if (!user || !userToken) {
      setError("请先登录 GitHub 账号后再投票");
      return;
    }

    const isVoted = votedItems.has(featureId);
    const action = isVoted ? "unvote" : "vote";
    
    setVotingItem(featureId);
    setError(null);

    try {
      const response = await fetch("/api/features", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          featureId,
          action,
          userToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "投票失败");
      }

      if (isVoted) {
        setVotedItems((prev) => {
          const next = new Set(prev);
          next.delete(featureId);
          return next;
        });
      } else {
        setVotedItems((prev) => new Set(prev).add(featureId));
      }

      setSuccessMessage(result.message || "操作成功！");
      await fetchFeatures();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "投票失败";
      // 检测权限不足错误，提示用户重新登录
      if (errorMessage.includes("scopes") || errorMessage.includes("scope") || errorMessage.includes("权限")) {
        // 清除旧的登录状态
        setUser(null);
        setUserToken(null);
        localStorage.removeItem("penbridge-auth");
        setError("登录权限已更新，请重新登录以使用投票功能");
      } else {
        setError(errorMessage);
      }
    } finally {
      setVotingItem(null);
    }
  };

  // 提交建议
  const handleSubmitSuggestion = async () => {
    if (!suggestTitle.trim() || !suggestDescription.trim()) {
      setError("请填写完整的标题和描述");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/features", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "suggest",
          title: suggestTitle.trim(),
          description: suggestDescription.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "提交失败");
      }

      setSuccessMessage("建议提交成功！感谢你的反馈");
      setShowSuggestModal(false);
      setSuggestTitle("");
      setSuggestDescription("");
      await fetchFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="py-16 gradient-bg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>你的声音很重要</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              功能调研
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              投票支持你最想要的功能，帮助我们确定开发优先级。
              你的每一票都将影响 PenBridge 的未来发展方向。
            </p>
          </motion.div>

          {/* 用户登录状态 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mt-8"
          >
            {user ? (
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-card border border-border">
                <img
                  src={user.avatar_url}
                  alt={user.login}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-sm font-medium">{user.name || user.login}</span>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#24292f] text-white font-medium hover:bg-[#24292f]/90 transition-colors"
              >
                <Github className="w-5 h-5" />
                使用 GitHub 登录以投票
              </button>
            )}
          </motion.div>

          {/* 统计 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 flex items-center justify-center gap-8"
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : totalVotes}
              </div>
              <div className="text-sm text-muted-foreground">总投票数</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {isLoading ? "-" : features.length}
              </div>
              <div className="text-sm text-muted-foreground">功能建议</div>
            </div>
            <div className="w-px h-12 bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {isLoading ? "-" : totalParticipants}
              </div>
              <div className="text-sm text-muted-foreground">参与者</div>
            </div>
          </motion.div>

          {/* 数据来源提示 */}
          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-6 flex items-center justify-center gap-2"
            >
              {dataSource === "github" ? (
                <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  数据来自 GitHub Discussions
                </span>
              ) : (
                <span className="text-sm text-muted-foreground flex items-center gap-1">
                  <Circle className="w-4 h-4" />
                  演示数据
                </span>
              )}
              <button
                onClick={fetchFeatures}
                className="p-1 rounded hover:bg-accent transition-colors"
                title="刷新数据"
              >
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </button>
            </motion.div>
          )}
        </div>
      </section>

      {/* 投票列表 */}
      <section className="py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 筛选器和提交建议按钮 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">状态:</span>
                <div className="flex gap-1">
                  {(["all", "voting", "planned", "completed"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilter(status)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        filter === status
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {status === "all" ? "全部" : statusConfig[status].label}
                    </button>
                  ))}
                </div>
              </div>
              {categories.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">分类:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setCategoryFilter("all")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                        categoryFilter === "all"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      全部
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                          categoryFilter === cat
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 提交建议按钮 */}
            <button
              onClick={() => setShowSuggestModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              提交建议
            </button>
          </div>

          {/* 成功消息 */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 text-center mb-8 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 加载状态 */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-lg bg-destructive/10 text-destructive text-center mb-8 flex items-center justify-center gap-2"
            >
              {error}
              {!user && (
                <button
                  onClick={handleLogin}
                  className="underline hover:no-underline"
                >
                  立即登录
                </button>
              )}
              <button
                onClick={() => setError(null)}
                className="ml-2 p-1 rounded hover:bg-destructive/20"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* 功能列表 */}
          {!isLoading && (
            <div className="space-y-4">
              {filteredFeatures.map((feature, index) => {
                const status = statusConfig[feature.status];
                const isVoted = votedItems.has(feature.id);
                const isVoting = votingItem === feature.id;
                const canVote = feature.status === "voting";

                return (
                  <motion.div
                    key={feature.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "p-5 rounded-xl border border-border bg-card transition-all",
                      canVote && "hover:border-primary/50 hover:shadow-md"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* 投票按钮 */}
                      <button
                        onClick={() => canVote && handleVote(feature.id)}
                        disabled={!canVote || isVoting}
                        className={cn(
                          "flex flex-col items-center gap-1 p-3 rounded-xl transition-all shrink-0 min-w-[60px]",
                          canVote
                            ? isVoted
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            : "bg-muted/50 text-muted-foreground cursor-not-allowed"
                        )}
                      >
                        {isVoting ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <ThumbsUp className={cn("w-5 h-5", isVoted && "fill-current")} />
                        )}
                        <span className="text-sm font-semibold">{feature.votes}</span>
                      </button>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{feature.title}</h3>
                          <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", status.color)}>
                            {status.label}
                          </span>
                          {isVoted && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              已投票
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground">{feature.description}</p>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Circle className="w-3 h-3" />
                            {feature.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* 未登录提示 */}
          {!user && !isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-8 p-6 rounded-xl bg-primary/5 border border-primary/10 text-center"
            >
              <LogIn className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">登录后参与投票</h3>
              <p className="text-muted-foreground mb-4">
                使用 GitHub 账号登录，即可为你喜欢的功能投票
              </p>
              <button
                onClick={handleLogin}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#24292f] text-white font-medium hover:bg-[#24292f]/90 transition-colors"
              >
                <Github className="w-5 h-5" />
                使用 GitHub 登录
              </button>
            </motion.div>
          )}

          {/* 提交建议区域 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12 p-8 rounded-2xl bg-muted/50 border border-border text-center"
          >
            <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">有新的功能建议？</h3>
            <p className="text-muted-foreground mb-6">
              直接在这里提交你的想法，或参与社区讨论
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowSuggestModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                提交建议
              </button>
              <a
                href={DISCUSSIONS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border bg-background font-medium hover:bg-accent transition-colors"
              >
                <Users className="w-4 h-4" />
                社区讨论
              </a>
            </div>
          </motion.div>

          {/* 说明 */}
          <div className="mt-8 p-4 rounded-lg bg-primary/5 border border-primary/10 text-sm">
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">关于投票</strong>
                <p className="text-muted-foreground mt-1">
                  投票数据会同步到{" "}
                  <a
                    href={DISCUSSIONS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    GitHub Discussions
                  </a>
                  ，你的投票将被永久记录并影响功能开发优先级。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 提交建议弹窗 */}
      <AnimatePresence>
        {showSuggestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={() => setShowSuggestModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">提交功能建议</h2>
                  <button
                    onClick={() => setShowSuggestModal(false)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      功能标题 <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={suggestTitle}
                      onChange={(e) => setSuggestTitle(e.target.value)}
                      placeholder="简短描述你想要的功能"
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      详细描述 <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      value={suggestDescription}
                      onChange={(e) => setSuggestDescription(e.target.value)}
                      placeholder="描述这个功能的使用场景和预期效果..."
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                      maxLength={1000}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {suggestDescription.length}/1000
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowSuggestModal(false)}
                    className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmitSuggestion}
                    disabled={isSubmitting || !suggestTitle.trim() || !suggestDescription.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    提交建议
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 静态功能数据（备用）
function getStaticFeatures(): FeaturesResponse {
  const now = new Date().toISOString();
  const features: Feature[] = [
    {
      id: "static-1",
      title: "更多图床支持",
      description: "支持七牛云、阿里云 OSS、GitHub 等更多图床",
      votes: 0,
      status: "voting",
      category: "功能增强",
      discussionId: "",
      discussionNumber: 0,
      createdAt: now,
    },
    {
      id: "static-2",
      title: "知乎专栏支持",
      description: "支持发布文章到知乎专栏",
      votes: 0,
      status: "voting",
      category: "平台支持",
      discussionId: "",
      discussionNumber: 0,
      createdAt: now,
    },
    {
      id: "static-3",
      title: "腾讯云开发者社区",
      description: "已支持发布到腾讯云开发者社区",
      votes: 0,
      status: "completed",
      category: "平台支持",
      discussionId: "",
      discussionNumber: 0,
      createdAt: now,
    },
    {
      id: "static-4",
      title: "掘金平台",
      description: "已支持发布到掘金技术社区",
      votes: 0,
      status: "completed",
      category: "平台支持",
      discussionId: "",
      discussionNumber: 0,
      createdAt: now,
    },
  ];

  return {
    features,
    totalVotes: features.reduce((sum, f) => sum + f.votes, 0),
    totalParticipants: 0,
    source: "static",
  };
}

export const Route = createFileRoute("/survey")({
  component: SurveyPage,
});
