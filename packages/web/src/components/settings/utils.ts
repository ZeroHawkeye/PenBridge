// 设置页面工具函数

// 检测是否在 Electron 环境中
export const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI !== undefined;
};
