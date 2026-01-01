/**
 * 执行后端工具 API 路由
 * 处理 AI 请求的后端工具调用
 */
import { Hono } from "hono";
import { validateSession } from "../services/adminAuth";
import { getToolExecutionLocation, executeBackendTool } from "../services/aiTools";

export const aiToolExecuteRouter = new Hono();

/**
 * 执行后端工具 API
 * POST /api/ai/tool/execute
 * 
 * 验证工具是否为后端工具，然后执行并返回结果
 */
aiToolExecuteRouter.post("/", async (c) => {
  try {
    // 验证登录状态
    const authHeader = c.req.header("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (!token) {
      return c.json({ error: "未登录" }, 401);
    }

    const session = await validateSession(token);
    if (!session) {
      return c.json({ error: "登录已过期" }, 401);
    }

    const body = await c.req.json();
    const { toolCallId, toolName, arguments: argsString } = body;

    if (!toolCallId || !toolName) {
      return c.json({ error: "缺少必要参数" }, 400);
    }

    // 验证是否为后端工具
    const location = getToolExecutionLocation(toolName);
    if (location !== "backend") {
      return c.json({
        error: `工具 ${toolName} 不是后端工具，应在前端执行`
      }, 400);
    }

    // 解析参数
    let args: Record<string, any> = {};
    try {
      args = JSON.parse(argsString || "{}");
    } catch {
      return c.json({ error: "参数解析失败" }, 400);
    }

    // 执行工具
    console.log(`[AI Tool] 执行后端工具: ${toolName}`, args);
    const result = await executeBackendTool(toolName, args);
    console.log(`[AI Tool] 工具执行结果:`, result);

    return c.json({
      toolCallId,
      ...result,
    });
  } catch (error) {
    console.error("[AI Tool] 工具执行异常:", error);
    return c.json({
      error: error instanceof Error ? error.message : "工具执行失败"
    }, 500);
  }
});
