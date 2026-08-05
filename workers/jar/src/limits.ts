/**
 * JAR 解析の入力制限。
 *
 * 解析はアプリ全体で最も CPU とメモリを使う経路で、しかも入力は
 * 外部から与えられる。件数ではなく 1 件あたりの重さで壊れるため、
 * 同時実行数より先に入力の上限を決める。
 *
 * 値はすべて Workers の 128 MB メモリ制限から逆算した保守的なもの。
 */

/**
 * 解析対象の最大バイト数。
 * JSZip は展開時に元データとは別に領域を取るため、メモリ上限の 1/4 に留める。
 */
export const MAX_INPUT_BYTES = 32 * 1024 * 1024;

/**
 * ZIP のエントリ数上限。
 * 極端に多いエントリは、1 件が小さくても走査だけで CPU を使い切る。
 */
export const MAX_ZIP_ENTRIES = 20_000;

/** 1 エントリの展開後サイズ上限。展開前に弾かないと zip bomb でメモリを持っていかれる */
export const MAX_ENTRY_BYTES = 4 * 1024 * 1024;

/**
 * 1 回の抽出で展開してよい合計バイト数。
 * 個々のエントリが上限内でも、総量では膨らみうるため別に持つ。
 */
export const MAX_EXTRACT_BYTES = 24 * 1024 * 1024;

/**
 * 同一 Isolate で同時に走らせる解析数。
 *
 * Isolate をまたいだ制御はできないため上限としては緩いが、
 * 1 つの Isolate が解析で埋まって他の処理を巻き込むのは防げる。
 */
export const MAX_CONCURRENT_ANALYSES = 2;

/**
 * JSZip が保持する展開後サイズ。公開 API に無いため内部構造を読む。
 * 取得できないこともあるので、呼び出し側は undefined を許容すること。
 */
export function uncompressedSize(entry: unknown): number | undefined {
  return (entry as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
}

/** 入力が上限を超えていることを表す。呼び出し側は 413 として扱う */
export class InputTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputTooLargeError";
  }
}

/** 解析の同時実行が上限に達していることを表す。呼び出し側は 429 として扱う */
export class TooManyAnalysesError extends Error {
  constructor() {
    super("Too many concurrent analyses");
    this.name = "TooManyAnalysesError";
  }
}

/** @throws InputTooLargeError 上限を超えている場合 */
export function assertInputSize(bytes: number): void {
  if (bytes <= MAX_INPUT_BYTES) return;
  throw new InputTooLargeError(`Input is ${bytes} bytes, limit is ${MAX_INPUT_BYTES}`);
}

/** @throws InputTooLargeError エントリ数が上限を超えている場合 */
export function assertEntryCount(count: number): void {
  if (count <= MAX_ZIP_ENTRIES) return;
  throw new InputTooLargeError(`Archive has ${count} entries, limit is ${MAX_ZIP_ENTRIES}`);
}

/**
 * 展開量の予算。使い切ったら打ち切る。
 *
 * 展開してから測るのでは遅いため、エントリの宣言サイズで先に判断する。
 */
export class ExtractBudget {
  private remaining = MAX_EXTRACT_BYTES;

  /** @returns このエントリを展開してよければ true */
  allow(entryBytes: number): boolean {
    if (entryBytes > MAX_ENTRY_BYTES) return false;
    if (entryBytes > this.remaining) return false;

    this.remaining -= entryBytes;
    return true;
  }

  get exhausted(): boolean {
    return this.remaining <= 0;
  }
}
