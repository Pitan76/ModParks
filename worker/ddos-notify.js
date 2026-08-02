/** Discord 通知の色（16進） */
const COLOR_ALERT = 0xff0000;
const COLOR_WARN = 0xffaa00;
const COLOR_OK = 0x00ff00;

/** Discord Webhook へ埋め込みメッセージを送る。通知の失敗で防護処理を止めない */
async function sendDiscord(webhookUrl, embeds) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds }),
    });
  } catch (err) {
    console.error("[DDOS-GUARD] Discord notification failed:", err);
  }
}

function dryRunLabel(env) {
  return env.DRY_RUN === "true" ? " [DRY-RUN]" : "";
}

/**
 * 状態遷移を ddos_audit へ記録する。
 * Discord 通知と違って流れて消えないので、後から「いつ何をきっかけに防護が入ったか」を追える。
 * 記録の失敗で防護そのものを巻き戻さないよう、例外は握りつぶす。
 */
export async function recordDdosAudit(db, action, state, detail) {
  try {
    await db.prepare(
      "INSERT INTO ddos_audit (id, action, state, detail) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), action, state, detail ? JSON.stringify(detail) : null).run();
  } catch (err) {
    console.error("[DDOS-GUARD] Failed to record audit log:", err);
  }
}

/** 攻撃検知による防護開始を通知する */
export async function notifyActivated(env, metrics) {
  await sendDiscord(env.DISCORD_WEBHOOK_URL, [
    {
      title: `🚨 ModParks DDoS Guard 発動${dryRunLabel(env)}`,
      description: `大量アクセスを検知したため WAF フィルタを有効化しました。\n**対象Slug**: \`${metrics.topSlug || "なし"}\` (全体防護判定含む)`,
      color: COLOR_ALERT,
      fields: [
        { name: "検知総数",               value: `${metrics.totalRequests} req / 10s`, inline: true },
        { name: "ダウンロード比率",       value: `${(metrics.downloadRatio * 100).toFixed(1)}%`, inline: true },
        { name: "分散度スコア (SUM IPs)", value: `${metrics.dispersionScore}`, inline: true },
        { name: "IP重複率",               value: `${metrics.ipRepeatRate.toFixed(2)}`, inline: true },
        { name: "最多Slug集中度",         value: `${(metrics.topSlugRatio * 100).toFixed(1)}%`, inline: true },
        { name: "検知国数",               value: `${metrics.approxCountries}`, inline: true },
        { name: "防護適用時間",           value: `${metrics.protectionDuration / 60000} 分`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    },
  ]);
}

/** 攻撃検知したが Cloudflare API 呼び出しに失敗したことを通知する */
export async function notifyActivationFailed(env, error) {
  await sendDiscord(env.DISCORD_WEBHOOK_URL, [
    {
      title: "⚠️ ModParks DDoS Guard エラー通知",
      description: `攻撃を検知しましたが Cloudflare API の呼び出しに失敗しました。APIレート保護のため2分間のCOOLDOWNに入ります。\nエラー内容: \`${error}\``,
      color: COLOR_WARN,
      timestamp: new Date().toISOString(),
    },
  ]);
}

/** 防護期限が切れて自動解除したことを通知する */
export async function notifyDeactivated(env) {
  await sendDiscord(env.DISCORD_WEBHOOK_URL, [
    {
      title: `✅ ModParks DDoS Guard 自動解除${dryRunLabel(env)}`,
      description: "防護期限（10分〜）が経過したため WAF フィルタを無効化し通常状態へ移行します。\n再発動防止のため、今後5分間はCOOLDOWN（再発動抑制）となります。",
      color: COLOR_OK,
      timestamp: new Date().toISOString(),
    },
  ]);
}
