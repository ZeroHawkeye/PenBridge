import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

/**
 * Linux 专用 Forge 配置
 * 在 CI 环境中使用：npx electron-forge make --config forge.config.linux.ts
 */
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: "PenBridge",
    executableName: "penbridge",
    appCopyright: "Copyright © 2026",
    icon: "./assets/icon",
    ignore: [
      /^\/src/,
      /^\/tsconfig\.json$/,
      /^\/forge\.config\.ts$/,
      /^\/forge\.config\.linux\.ts$/,
      /^\/\.gitignore$/,
      /^\/nul$/,
      /^\/out$/,
      /node_modules\/\.cache/,
    ],
  },
  rebuildConfig: {},
  makers: [
    // 通用 ZIP 包
    new MakerZIP({}, ["linux"]),
    // Linux DEB 包（Debian/Ubuntu）
    new MakerDeb({
      options: {
        name: "penbridge",
        productName: "PenBridge",
        icon: "./assets/icon.png",
        categories: ["Utility", "Office"],
        description: "腾讯云开发者社区文章管理工具",
        maintainer: "PenBridge Team",
      },
    }),
    // Linux RPM 包（Fedora/CentOS）
    new MakerRpm({
      options: {
        name: "penbridge",
        productName: "PenBridge",
        icon: "./assets/icon.png",
        categories: ["Utility", "Office"],
        description: "腾讯云开发者社区文章管理工具",
      },
    }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};

export default config;
