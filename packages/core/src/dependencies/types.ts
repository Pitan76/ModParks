/**
 * 依存関係の共通の型と定数。
 *
 * Server Action のファイル（"use server"）は非同期関数しか公開できないため、
 * 定数を共有したい側はこちらを参照する。
 */

/** 1 バージョンに付けられる依存関係の上限。UI の事故と手書きリクエストの両方を抑える */
export const MAX_DEPENDENCY_DRAFTS = 30;

export const DEPENDENCY_TYPES = ["required", "optional", "incompatible", "embedded"] as const;

export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

/**
 * 画面で組み立て中の依存関係。まだ保存されていないため id を持たない。
 *
 * バージョンのアップロードでは、バージョンが出来る前に依存を決めることになる。
 * その間の入れ物としてこの形を使い、保存時にまとめて 1 バージョン分を書き込む。
 */
export type DependencyDraft = {
  dependencyType: DependencyType;
  /** ModParks 内のプロジェクトへの依存ならスラッグ */
  targetSlug?: string;
  /** 外部サイトへの依存なら表示名とURL */
  externalName?: string;
  externalUrl?: string;
  /** 依存が要るプラットフォーム。空なら全プラットフォーム */
  loaders?: string[];
};
