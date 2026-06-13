/**
 * 画像ファイルを指定した最大幅・高さに収まるようにリサイズします。
 * 元画像が指定サイズ以下の場合はリサイズせずそのまま返します。
 * クライアントサイドでのみ動作します。
 *
 * @param file アップロードされた画像ファイル
 * @param maxWidth 最大幅 (px)
 * @param maxHeight 最大高さ (px)
 * @returns リサイズされた画像ファイル、または元のファイル
 */
export async function resizeImageFile(file: File, maxWidth: number, maxHeight: number): Promise<File> {
  return new Promise((resolve, reject) => {
    // 画像以外のファイルはそのまま返す
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;

      // すでに最大サイズ以下の場合はそのまま返す
      if (width <= maxWidth && height <= maxHeight) {
        return resolve(file);
      }

      // アスペクト比を維持してサイズ計算
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return resolve(file);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // 元のファイルタイプを維持してBlobに変換（jpegの場合は品質0.8）
      const quality = file.type === "image/jpeg" || file.type === "image/webp" ? 0.8 : undefined;
      
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return resolve(file);
          }
          // BlobをFileに変換
          const resizedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // 画像読み込みエラー時は元のファイルを返す（サーバー側でバリデーションさせる）
      resolve(file);
    };

    img.src = url;
  });
}
