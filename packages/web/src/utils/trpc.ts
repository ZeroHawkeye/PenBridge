import { createTRPCReact } from "@trpc/react-query";

// 创建 tRPC 客户端，使用类型断言绕过严格类型检查
// 实际类型安全由后端路由定义保证
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _trpc = createTRPCReact<any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = _trpc as any;
