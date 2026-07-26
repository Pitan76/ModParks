/**
 * modparks-push Worker のバインディング定義。
 *
 * Web Push（RFC 8291 aes128gcm 暗号化 + RFC 8292 VAPID JWT）だけを Web Crypto で
 * 実行する純粋計算 Worker。DB / Cookie / R2 には触れず、宛先・鍵・本文はすべて
 * 呼び出し元（メインアプリ）から受け取る。Service Binding 経由でのみ到達可能
 * （workers_dev = false）。
 */
export interface PushWorkerEnv {
  // バインディングなし（純粋計算のみ）
}
