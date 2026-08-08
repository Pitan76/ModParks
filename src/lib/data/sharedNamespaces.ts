/**
 * @fileoverview 共有ネームスペースの定義。
 *
 * `c` / `forge` / `neoforge` は複数の mod が同じタグを分担して定義する共通タグの置き場で、
 * `minecraft` はバニラです。いずれも特定の投稿者の持ち物ではないため、レシピ本体や
 * テクスチャの取り込み対象からは外し、タグだけを受け入れます。
 *
 * ここを通してしまうと、jar に同梱されたバニラのレシピが共有ネームスペースへ流れ込み、
 * 無関係なプロジェクトの一覧にバニラレシピが並びます。
 *
 * mp-recipe 側の `core/namespaces.ts` と同じ内容。別デプロイの Worker なので実体は共有できません。
 * 増やすときは両方に入れること。
 */

/** 誰の所有物にもならないネームスペース。 */
export const SHARED_NAMESPACES: readonly string[] = ["c", "forge", "neoforge", "minecraft"];

/**
 * 共有ネームスペースかどうかを返します。
 * @param ns ネームスペース
 */
export function isSharedNamespace(ns: string): boolean {
  return SHARED_NAMESPACES.includes(ns);
}
