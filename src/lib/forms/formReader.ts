/**
 * 部分更新の Server Action が FormData を読むための薄い層。
 *
 * 素の `formData.get(key)` は「画面に無い項目」でも null を返すため、
 * それをそのまま zod に渡すと *送っていない項目* で検証が落ち、
 * フォーム側にはその項目が無いのでエラーも表示されず「保存が無反応」になる。
 * 未送信は必ず undefined（＝触らない）に落とすのがこの層の責務。
 */

/** チェックボックスの「送信された上でオフ」を表すために添える hidden の値 */
export const CHECKBOX_ABSENT_VALUE = "off";

/**
 * 部分更新用の FormData リーダー。
 *
 * 「未送信」と「空で送信」を必ず区別する。前者は undefined（更新しない）、
 * 後者は用途に応じて空文字や null（クリア）になる。
 */
export class FormReader {
  constructor(private readonly formData: FormData) {}

  /** 未送信なら undefined。送信された文字列はそのまま返す */
  text(key: string): string | undefined {
    const value = this.formData.get(key);
    if (value === null) return undefined;
    return String(value);
  }

  /** 未送信なら undefined、空文字なら null（＝値をクリアする意思表示） */
  nullableText(key: string): string | null | undefined {
    const value = this.text(key);
    if (value === undefined) return undefined;
    return value === "" ? null : value;
  }

  /** 未送信なら undefined。送信されていれば（空でも）配列を返す */
  list(key: string): string[] | undefined {
    if (!this.formData.has(key)) return undefined;
    return this.formData.getAll(key).map(String);
  }

  /**
   * チェックボックス／スイッチ。
   *
   * 未チェックのチェックボックスは何も送らないので、送信有無だけでは
   * 「オフ」と「画面に無い」を区別できない。`CheckboxField` が同名の
   * hidden（値 "off"）を必ず添えるので、その存在を送信の証拠として使う。
   */
  checkbox(key: string): boolean | undefined {
    const values = this.formData.getAll(key).map(String);
    if (values.length === 0) return undefined;
    return values.includes("on");
  }
}
