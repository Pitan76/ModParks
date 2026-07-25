/** modparks-push Worker の Service Binding I/O 型 */

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    /** クライアント公開鍵（base64url） */
    p256dh: string;
    /** 認証シークレット（base64url） */
    auth: string;
  };
}

export interface VapidKeys {
  /** VAPID 公開鍵（base64url, uncompressed EC P-256 点 65byte） */
  publicKey: string;
  /** VAPID 秘密鍵（base64url, 32byte スカラー） */
  privateKey: string;
  /** サブジェクト（mailto: か https: の連絡先URL） */
  subject: string;
}

/** POST /send : 1 購読へ 1 通知を送る */
export interface SendRequest {
  subscription: PushSubscriptionJSON;
  /** Service Worker の push ハンドラへ渡す JSON 文字列 */
  payload: string;
  vapid: VapidKeys;
  /** 秒。既定 2419200 (28日) */
  ttl?: number;
}

export interface SendResult {
  /** プッシュサービスが受理した (2xx) */
  ok: boolean;
  status: number;
  /** 購読が失効している（404/410）。呼び出し側は DB から削除すべき */
  expired: boolean;
  error?: string;
}
