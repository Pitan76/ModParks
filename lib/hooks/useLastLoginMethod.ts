"use client";

import { useSyncExternalStore } from "react";

/** ログイン画面で選択できる認証手段の識別子 */
export type LoginMethod = "credentials" | "github" | "google" | "passkey" | "resend";

const STORAGE_KEY = "modparks:lastLoginMethod";

const LOGIN_METHODS: readonly LoginMethod[] = ["credentials", "github", "google", "passkey", "resend"];

function isLoginMethod(value: string | null): value is LoginMethod {
  return !!value && LOGIN_METHODS.includes(value as LoginMethod);
}

/**
 * 前回ログインに使った認証手段を記録する。
 * サーバーに保存すると未ログイン状態では引けないため、端末ローカルに持つ。
 */
export function rememberLoginMethod(method: LoginMethod): void {
  // プライベートモード等で localStorage が使えない場合でもログインは継続させる
  try {
    window.localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // 記憶できないだけなので無視する
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function getSnapshot(): LoginMethod | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLoginMethod(stored) ? stored : null;
  } catch {
    // 読めない場合はバッジを出さないだけ
    return null;
  }
}

/**
 * 前回ログインに使った認証手段を返す。
 * サーバー描画時は不明なため null を返し、ハイドレート後にバッジが現れる。
 */
export function useLastLoginMethod(): LoginMethod | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
