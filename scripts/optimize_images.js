const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const WORKSPACE_DIR = path.resolve(__dirname, '..');

async function main() {
  // 1. hero.png を hero.webp に変換
  const heroPngPath = path.join(WORKSPACE_DIR, 'public', 'hero.png');
  const heroWebpPath = path.join(WORKSPACE_DIR, 'public', 'hero.webp');
  
  if (fs.existsSync(heroPngPath)) {
    console.log('Optimizing hero.png...');
    // 幅1200pxにリサイズしてWebPに変換
    await sharp(heroPngPath)
      .resize(1200)
      .webp({ quality: 80 })
      .toFile(heroWebpPath);
    console.log('Saved hero.webp');
  } else {
    console.log('hero.png not found');
  }

  // 2. loaders 内の画像をリサイズ
  const loadersDir = path.join(WORKSPACE_DIR, 'public', 'icons', 'loaders');
  if (fs.existsSync(loadersDir)) {
    const files = fs.readdirSync(loadersDir);
    for (const file of files) {
      if (file.endsWith('.png')) {
        const filePath = path.join(loadersDir, file);
        const stats = fs.statSync(filePath);
        
        console.log(`Optimizing loader icon: ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
        
        try {
          const buffer = await sharp(filePath)
            .resize(48, 48, { fit: 'inside' })
            .toBuffer();
          
          fs.writeFileSync(filePath, buffer);
          const newStats = fs.statSync(filePath);
          console.log(`-> Resized to 48x48: ${(newStats.size / 1024).toFixed(1)} KB`);
        } catch (e) {
          console.error(`Failed to optimize ${file}:`, e);
        }
      }
    }
  }
}

main().catch(console.error);
