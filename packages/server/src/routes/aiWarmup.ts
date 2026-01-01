/**
 * AI 连接预热 API 路由
 * 测试 AI 供应商连接延迟
 */
import { Hono } from "hono";

export const aiWarmupRouter = new Hono();

/**
 * AI 连接预热 API（测试连接延迟）
 * POST /api/ai/warmup
 * 
 * 发送简单请求预热连接，获取延迟信息
 */
aiWarmupRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { baseUrl } = body;

    if (!baseUrl) {
      return c.json({ error: "缺少 baseUrl 参数" }, 400);
    }

    const results: { step: string; duration: number }[] = [];
    const startTime = Date.now();

    // 解析 URL
    const urlObj = new URL(baseUrl);
    const hostname = urlObj.hostname;
    results.push({ step: "URL解析", duration: Date.now() - startTime });

    // DNS 查询（通过简单的 fetch 触发）
    const dnsStart = Date.now();
    try {
      // 发送一个简单的 HEAD 请求来预热连接
      const testUrl = `${baseUrl}/models`;
      console.log(`[AI Warmup] 测试连接: ${testUrl}`);

      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      results.push({
        step: `连接测试 (status=${response.status})`,
        duration: Date.now() - dnsStart
      });
    } catch (error) {
      results.push({
        step: `连接测试失败: ${error instanceof Error ? error.message : "未知错误"}`,
        duration: Date.now() - dnsStart
      });
    }

    const totalDuration = Date.now() - startTime;

    console.log(`[AI Warmup] ${hostname} 预热完成:`, results);

    return c.json({
      success: true,
      hostname,
      totalDuration,
      results,
    });
  } catch (error) {
    console.error("[AI Warmup] 预热失败:", error);
    return c.json({
      error: error instanceof Error ? error.message : "预热失败"
    }, 500);
  }
});
