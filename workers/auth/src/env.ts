/**
 * modparks-auth Worker のバインディング定義。
 *
 * WebAuthn の option 生成・検証（@simplewebauthn/server の暗号処理）だけを
 * 隔離する純粋計算 Worker。DB / Cookie / R2 には触れず、呼び出し元（メインアプリ）
 * が状態を管理する。Service Binding 経由でのみ到達可能にする（workers_dev = false）。
 */
export interface AuthWorkerEnv {
  // バインディングなし（純粋計算のみ）
}
