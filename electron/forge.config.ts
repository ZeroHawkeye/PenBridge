import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // 将 server 目录解包，因为后端需要作为独立进程运行
      unpack: "**/server/**",
    },
    name: "PenBridge",
    executableName: "penbridge",
    appCopyright: "Copyright © 2026",
    icon: "./assets/icons", // 应用图标路径（不带扩展名，打包时自动匹配 .ico/.icns/.png）
    ignore: [
      /^\/src/,
      /^\/tsconfig\.json$/,
      /^\/forge\.config\.ts$/,
      /^\/\.gitignore$/,
      /^\/nul$/,
      /^\/out$/,
      /node_modules\/\.cache/,
    ],
  },
  rebuildConfig: {},
  makers: [
    // Windows 安装程序
    new MakerSquirrel({
      name: "penbridge",
      setupIcon: "./assets/icon.ico",
      authors: "PenBridge Team",
      description: "PenBridge - 文章管理与发布工具",
    }),
    // 通用 ZIP 包（所有平台）
    new MakerZIP({}, ["darwin", "win32", "linux"]),
    // Linux DEB/RPM 包通过 CI 环境动态安装
    // 使用 @electron-forge/maker-deb 和 @electron-forge/maker-rpm
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
};

export default config;
