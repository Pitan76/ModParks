"use client";

import { useEffect, useState } from "react";

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

/**
 * 前回ログインに使った認証手段を返す。
 * SSR と初回描画の不一致を避けるため、マウント後に読み込む。
 */
export function useLastLoginMethod(): LoginMethod | null {
  const [method, setMethod] = useState<LoginMethod | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isLoginMethod(stored)) setMethod(stored);
    } catch {
      // 読めない場合はバッジを出さないだけ
    }
  }, []);

  return method;
}
