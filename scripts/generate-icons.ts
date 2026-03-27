import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SVG_PATH = path.join(__dirname, '../public/logo.svg');
const PUBLIC_DIR = path.join(__dirname, '../public');

// ICO 需要的 PNG 尺寸
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function generatePngs(sizes: number[], outputDir: string): Promise<string[]> {
  const pngPaths: string[] = [];
  
  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    pngPaths.push(outputPath);
    console.log(`Generated: ${outputPath}`);
  }
  
  return pngPaths;
}

async function generateIco() {
  console.log('\n📦 Generating Windows ICO...');
  
  const icoDir = path.join(PUBLIC_DIR, 'ico-temp');
  if (!fs.existsSync(icoDir)) {
    fs.mkdirSync(icoDir, { recursive: true });
  }
  
  // 生成 PNG 文件
  const pngPaths = await generatePngs(ICO_SIZES, icoDir);
  
  const { default: pngToIco } = await import('png-to-ico');
  
  const icoPath = path.join(PUBLIC_DIR, 'app.ico');
  const buffer = await pngToIco(pngPaths);
  fs.writeFileSync(icoPath, buffer);
  console.log(`✅ Generated: ${icoPath}`);
  
  // 清理临时文件
  for (const pngPath of pngPaths) {
    fs.unlinkSync(pngPath);
  }
  fs.rmdirSync(icoDir);
  
  return icoPath;
}

async function generateIcns() {
  console.log('\n📦 Generating macOS ICNS resources...');
  
  // 创建 iconset 目录
  const iconsetDir = path.join(PUBLIC_DIR, 'app.iconset');
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }
  
  // iconset 需要的文件映射
  const iconsetFiles = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];
  
  // 生成所有需要的尺寸并缓存
  const generatedPaths: string[] = [];
  const sizeToPath: Map<number, string> = new Map();
  
  for (const item of iconsetFiles) {
    const size = item.size;
    if (!sizeToPath.has(size)) {
      const tempPath = path.join(iconsetDir, `temp-${size}.png`);
      await sharp(SVG_PATH)
        .resize(size, size)
        .png()
        .toFile(tempPath);
      sizeToPath.set(size, tempPath);
      generatedPaths.push(tempPath);
      console.log(`Generated temp: ${tempPath}`);
    }
    
    // 复制到目标文件名
    const srcPath = sizeToPath.get(size)!;
    const destPath = path.join(iconsetDir, item.name);
    fs.copyFileSync(srcPath, destPath);
    console.log(`Created: ${destPath}`);
  }
  
  // 清理临时文件
  for (const tempPath of generatedPaths) {
    if (tempPath.includes('temp-')) {
      fs.unlinkSync(tempPath);
    }
  }
  
  console.log(`\n✅ Created iconset directory: ${iconsetDir}`);
  console.log('   On macOS, run: iconutil -c icns public/app.iconset');
  
  // 生成一个 512x512 PNG 作为参考
  const png512Path = path.join(PUBLIC_DIR, 'icon-512.png');
  await sharp(SVG_PATH)
    .resize(512, 512)
    .png()
    .toFile(png512Path);
  console.log(`✅ Generated PNG: ${png512Path}`);
  
  return iconsetDir;
}

async function main() {
  console.log('🎨 Icon Generator for Secure Ledger');
  console.log('=====================================');
  
  if (!fs.existsSync(SVG_PATH)) {
    console.error('❌ SVG file not found:', SVG_PATH);
    process.exit(1);
  }
  
  console.log('📁 Source SVG:', SVG_PATH);
  
  try {
    // 生成 ICO
    await generateIco();
    
    // 生成 ICNS (iconset)
    await generateIcns();
    
    console.log('\n✨ All done!');
    console.log('\nGenerated files:');
    console.log(`  - ${path.join(PUBLIC_DIR, 'app.ico')} (Windows)`);
    console.log(`  - ${path.join(PUBLIC_DIR, 'app.iconset/')} (macOS)`);
    console.log(`  - ${path.join(PUBLIC_DIR, 'icon-512.png')} (Reference PNG)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();