const https = require('https');
const fs = require('fs');
const path = require('path');

const loaders = {
  fabric: 'https://github.com/FabricMC.png',
  forge: 'https://github.com/MinecraftForge.png',
  neoforge: 'https://github.com/neoforged.png',
  quilt: 'https://github.com/QuiltMC.png',
  paper: 'https://github.com/PaperMC.png',
  purpur: 'https://github.com/PurpurMC.png',
  velocity: 'https://github.com/PaperMC.png',
  waterfall: 'https://github.com/PaperMC.png'
};

const dir = path.join(__dirname, '../public/icons/loaders');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  for (const [name, url] of Object.entries(loaders)) {
    const dest = path.join(dir, `${name}.png`);
    await download(url, dest);
  }
}

main().catch(console.error);
