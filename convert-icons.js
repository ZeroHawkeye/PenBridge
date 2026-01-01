// 临时脚本：将 SVG 转换为各尺寸 PNG 和 ICO
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'packages/web/public/icon-v8.svg');
const electronIconsDir = path.join(__dirname, 'electron/assets/icons');
const electronAssetsDir = path.join(__dirname, 'electron/assets');

const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function convertIcons() {
  const svgBuffer = fs.readFileSync(svgPath);
  
  // 生成各尺寸 PNG
  for (const size of sizes) {
    const outputPath = path.join(electronIconsDir, `${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${size}x${size}.png`);
  }
  
  // 生成 icon-1024.png (用于其他用途)
  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(path.join(electronAssetsDir, 'icon-1024.png'));
  console.log('Generated: icon-1024.png');
  
  // 生成 ICO 文件 (Windows)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngFiles = icoSizes.map(size => path.join(electronIconsDir, `${size}x${size}.png`));
  const icoBuffer = await pngToIco(pngFiles);
  fs.writeFileSync(path.join(electronIconsDir, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(electronAssetsDir, 'icon.ico'), icoBuffer);
  console.log('Generated: icon.ico');
  
  console.log('Done!');
  console.log('Note: ICNS file for macOS needs to be generated separately on a Mac.');
}

convertIcons().catch(console.error);
