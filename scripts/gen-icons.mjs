/**
 * public/icon.png を元に、検索結果・PWA・iOS 用のアイコン一式を生成する。
 *
 * Google のファビコンは「正方形かつ 48px の倍数」でないと採用されないことがあるため、
 * favicon.ico は 48/96/144 のマルチサイズで作る。
 *
 * 使い方: node scripts/gen-icons.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PUBLIC_DIR = join(process.cwd(), "public");
const SOURCE = join(PUBLIC_DIR, "icon.png");

const ICO_SIZES = [48, 96, 144];
const PNG_OUTPUTS = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

/** @param size 出力する正方形の一辺 */
function resize(size) {
  return sharp(SOURCE).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
}

/**
 * PNG を格納する ICO を組み立てる。
 * ICO のヘッダは幅・高さを 1 バイトで持つため 256 は 0 で表す（今回は最大 144 なのでそのまま）。
 *
 * @param images [{ size, buffer }] の配列
 */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(16 * images.length);
  let offset = header.length + directory.length;

  images.forEach((image, index) => {
    const entry = index * 16;
    directory.writeUInt8(image.size % 256, entry);
    directory.writeUInt8(image.size % 256, entry + 1);
    directory.writeUInt8(0, entry + 2);
    directory.writeUInt8(0, entry + 3);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.buffer.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.buffer.length;
  });

  return Buffer.concat([header, directory, ...images.map((i) => i.buffer)]);
}

async function main() {
  readFileSync(SOURCE);

  for (const { file, size } of PNG_OUTPUTS) {
    writeFileSync(join(PUBLIC_DIR, file), await resize(size));
    console.log(`generated public/${file} (${size}x${size})`);
  }

  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, buffer: await resize(size) });
  }
  writeFileSync(join(PUBLIC_DIR, "favicon.ico"), buildIco(icoImages));
  console.log(`generated public/favicon.ico (${ICO_SIZES.join(", ")})`);
}

main();
