/**
 * 平台语法支持配置
 * 定义各平台对扩展语法的支持程度和处理策略
 */

import type { PlatformSyntaxConfig, TransformStrategy } from "./types";

/**
 * 各平台的语法支持配置
 */
export const platformConfigs: Record<string, PlatformSyntaxConfig> = {
  // 腾讯云开发者社区 - 支持对齐语法，保持原样（因为是腾讯云的原生语法）
  tencent: {
    platform: "tencent",
    name: "腾讯云开发者社区",
    supportsHtml: true,
    strategies: {
      // 对齐语法腾讯云原生支持，保持原样
      left: "keep",
      right: "keep",
      center: "keep",
      justify: "keep",
    },
    defaultStrategy: "toHtml",
  },
  
  // 掘金 - 不支持对齐语法，需要移除
  juejin: {
    platform: "juejin",
    name: "掘金",
    supportsHtml: false,
    strategies: {
      // 对齐语法掘金不支持，移除指令语法，只保留内容
      left: "remove",
      right: "remove",
      center: "remove",
      justify: "remove",
    },
    defaultStrategy: "remove",
  },
  
  // CSDN - 不支持对齐语法，需要移除
  csdn: {
    platform: "csdn",
    name: "CSDN",
    supportsHtml: true,  // CSDN 支持部分 HTML，但不支持对齐指令
    strategies: {
      // 对齐语法 CSDN 不支持，移除指令语法，只保留内容
      left: "remove",
      right: "remove",
      center: "remove",
      justify: "remove",
    },
    defaultStrategy: "remove",
  },
};

/**
 * 获取平台配置
 */
export function getPlatformConfig(platform: string): PlatformSyntaxConfig {
  return platformConfigs[platform] || {
    platform,
    name: platform,
    supportsHtml: false,
    strategies: {},
    defaultStrategy: "remove",
  };
}

/**
 * 获取指定平台对特定语法的处理策略
 */
export function getTransformStrategy(
  platform: string,
  directiveName: string
): TransformStrategy {
  const config = getPlatformConfig(platform);
  return config.strategies[directiveName] || config.defaultStrategy;
}
