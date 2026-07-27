import openNextWorker from "./.open-next/worker.js";

const CRON_ROUTES = {
  "0 * * * *": "/api/cron/sync-external",
  "0 3 * * *": "/api/cron/backup",
};

async function invokeCronRoute(path, env, ctx) {
  const req = new Request(`http://localhost${path}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${env.CRON_SECRET || ""}`
    }
  });
  try {
    const res = await openNextWorker.fetch(req, env, ctx);
    if (res.ok) {
      console.log(`Cron ${path} processed successfully:`, await res.json());
    } else {
      console.error(`Cron ${path} failed with status:`, res.status, await res.text());
    }
  } catch (e) {
    console.error(`Cron ${path} fetch error:`, e);
  }
}

// ─── DDoS Defense (自動DDoS防御システム) ──────────────────────────────────────

const ISOLATE_ID = Math.random().toString(36).substring(2);

let currentBucket = 0;
let localRequestCount = 0;
let localDownloadCount = 0;
let localIPs = new Set();
let localCountries = new Set();
let localSlugs = {};

let lastFlushTime = 0;
let isFlushing = false;
let isTransitioning = false;

let cachedState = null;
let cachedStateTime = 0;

// Discord通知
async function sendDdosDiscordNotification(webhookUrl, embeds) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds })
    });
  } catch (err) {
    console.error("[DDOS-GUARD] Discord notification failed:", err);
  }
}

// Cloudflare API 呼び出し (WAF Rulesets API)
async function toggleDdosProtection(env, enable, topSlug) {
  const isDryRun = env.DRY_RUN === "true";
  console.log(`[DDOS-GUARD] toggleDdosProtection: enable=${enable}, topSlug=${topSlug}, dryRun=${isDryRun}`);

  if (isDryRun) {
    return { success: true };
  }

  if (!env.CF_WAF_API_TOKEN || !env.CF_ZONE_ID || !env.CF_RULESET_ID || !env.CF_WAF_RULE_ID) {
    console.error("[DDOS-GUARD] Missing Cloudflare API configuration environment variables");
    return { success: false, error: "Missing config" };
  }

  const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${env.CF_RULESET_ID}/rules/${env.CF_WAF_RULE_ID}`;

  // WAF expression の安全な定義 (引数argsでの完全一致とallowlist検証)
  const isSafeSlug = topSlug && /^[a-z0-9-]{1,64}$/.test(topSlug);
  const expression = (enable && isSafeSlug)
    ? `(http.request.uri.path contains "/api/download" and http.request.uri.args["slug"][0] eq "${topSlug}")`
    : `(http.request.uri.path contains "/api/download")`; // 不正なslugまたは無効時はフォールバック

  const body = enable
    ? { enabled: true, expression }
    : { enabled: false, expression: `(http.request.uri.path eq "/dev/null")` }; // 無効化時はダミー式へ

  const init = {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${env.CF_WAF_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };

  try {
    const res = await fetch(url, init);
    const data = await res.json();
    if (!res.ok || !data.success) {
      const errMsg = data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}`;
      return { success: false, error: errMsg };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Cloudflare API から現在のWAF設定（enabled）を取得する
async function fetchCurrentWafRuleStatus(env) {
  if (!env.CF_WAF_API_TOKEN || !env.CF_ZONE_ID || !env.CF_RULESET_ID || !env.CF_WAF_RULE_ID) {
    return null;
  }
  const url = `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${env.CF_RULESET_ID}/rules/${env.CF_WAF_RULE_ID}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${env.CF_WAF_API_TOKEN}` }
    });
    const data = await res.json();
    if (res.ok && data.success && data.result) {
      return data.result.enabled; // true or false
    }
  } catch (e) {
    console.error("[DDOS-GUARD] fetchWafStatus failed:", e);
  }
  return null;
}

// D1から最新状態を取得 (5秒キャッシュ)
async function getDdosState(db) {
  const now = Date.now();
  if (cachedState && (now - cachedStateTime < 5000)) {
    return cachedState;
  }
  try {
    const state = await db.prepare("SELECT current_state, attack_detected_at, under_attack_enabled_at, scheduled_disable_at, cooldown_until, protection_duration, last_normal_at, updated_at FROM ddos_state WHERE state_key = 'global'").first();
    if (state) {
      const mapped = {
        currentState: state.current_state,
        attackDetectedAt: state.attack_detected_at,
        underAttackEnabledAt: state.under_attack_enabled_at,
        scheduledDisableAt: state.scheduled_disable_at,
        cooldownUntil: state.cooldown_until,
        protectionDuration: state.protection_duration,
        lastNormalAt: state.last_normal_at,
        updatedAt: state.updated_at
      };
      cachedState = mapped;
      cachedStateTime = now;
      return cachedState;
    }
  } catch (err) {
    console.error("[DDOS-GUARD] Failed to get DdosState from D1:", err);
  }
  return { currentState: "NORMAL", lastNormalAt: 0, protectionDuration: 600000 };
}

// 判定処理とWAF有効化
async function evaluateAndTriggerDdos(env, sliceTime) {
  if (isTransitioning) return;
  isTransitioning = true;

  try {
    // 1. 直近2スライス (20秒分) を集計
    const thresholdTime = sliceTime - 10;
    
    // SUM集計クエリ
    const stats = await env.DB.prepare(
      "SELECT SUM(request_count) as total_requests, SUM(download_count) as total_downloads, SUM(unique_ip_count) as dispersion_score, SUM(unique_country_count) as approx_countries FROM ddos_slices WHERE slice_time >= ?"
    ).bind(thresholdTime).first();

    if (!stats || !stats.total_requests) {
      isTransitioning = false;
      return;
    }

    // GROUP BY による最多アクセスslugの算出
    const topSlugRow = await env.DB.prepare(
      "SELECT top_slug, SUM(top_slug_count) as total_slug_count FROM ddos_slices WHERE slice_time >= ? AND top_slug IS NOT NULL GROUP BY top_slug ORDER BY total_slug_count DESC LIMIT 1"
    ).bind(thresholdTime).first();

    const totalRequests = stats.total_requests;
    const totalDownloads = stats.total_downloads || 0;
    const dispersionScore = stats.dispersion_score || 0;
    const approxCountries = stats.approx_countries || 0;
    const topSlug = topSlugRow ? topSlugRow.top_slug : "";
    const topSlugCount = topSlugRow ? topSlugRow.total_slug_count : 0;

    const downloadRatio = totalRequests > 0 ? (totalDownloads / totalRequests) : 0;
    const topSlugRatio = totalRequests > 0 ? (topSlugCount / totalRequests) : 0;
    const ipRepeatRate = dispersionScore > 0 ? (totalRequests / dispersionScore) : 0;

    console.log(`[DDOS-GUARD] Evaluation: reqs=${totalRequests}, dls=${totalDownloads}(${(downloadRatio*100).toFixed(1)}%), dispersion=${dispersionScore}, repeatRate=${ipRepeatRate.toFixed(2)}, topSlug=${topSlug}(${(topSlugRatio*100).toFixed(1)}%)`);

    // 攻撃検知5条件の検証
    const isAttack =
      totalRequests >= 1000 &&
      downloadRatio >= 0.8 &&
      topSlugRatio >= 0.75 &&
      ipRepeatRate >= 5.0;

    if (isAttack) {
      console.log(`[DDOS-GUARD] Attack detected! Reqs=${totalRequests}, IPrepeat=${ipRepeatRate.toFixed(2)}, slug=${topSlug}`);
      
      const now = Date.now();
      // D1 の条件付き UPDATE による楽観ロック
      const updateRes = await env.DB.prepare(
        "UPDATE ddos_state SET current_state = 'ACTIVATING', updated_at = ? WHERE state_key = 'global' AND current_state = 'NORMAL'"
      ).bind(now).run();

      if (updateRes.meta.changes === 1) {
        console.log("[DDOS-GUARD] Won activation lock. Calling Cloudflare API...");
        
        // 直近状態の再取得 (最新の protection_duration / last_normal_at のため)
        const currentStateRecord = await env.DB.prepare("SELECT protection_duration, last_normal_at FROM ddos_state WHERE state_key = 'global'").first();
        let protectionDuration = 600000; // 10分
        if (currentStateRecord) {
          const lastNormal = currentStateRecord.last_normal_at;
          const currentDuration = currentStateRecord.protection_duration;
          // 前回の復帰から15分以内の再検知ならバックオフで2倍に拡張
          if (now - lastNormal <= 900000) {
            protectionDuration = Math.min(currentDuration * 2, 3600000); // 最大60分
            console.log(`[DDOS-GUARD] Backoff activated. Extending duration to ${protectionDuration / 60000} mins`);
          }
        }

        // WAF有効化
        const apiRes = await toggleDdosProtection(env, true, topSlug);

        if (apiRes.success) {
          const scheduledDisableAt = now + protectionDuration;
          await env.DB.prepare(
            "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', attack_detected_at = ?, under_attack_enabled_at = ?, scheduled_disable_at = ?, protection_duration = ?, updated_at = ? WHERE state_key = 'global'"
          ).bind(now, now, scheduledDisableAt, protectionDuration, now).run();
          
          cachedState = null; // キャッシュクリア
          console.log("[DDOS-GUARD] Successfully enabled WAF custom rule.");

          // Discord 通知
          const dryLabel = env.DRY_RUN === "true" ? " [DRY-RUN]" : "";
          await sendDdosDiscordNotification(env.DISCORD_WEBHOOK_URL, [
            {
              title: `🚨 ModParks DDoS Guard 発動${dryLabel}`,
              description: `大量アクセスを検知したため WAF フィルタを有効化しました。\n**対象Slug**: \`${topSlug || "なし"}\` (全体防護判定含む)`,
              color: 0xff0000,
              fields: [
                { name: "検知総数", value: `${totalRequests} req / 10s`, inline: true },
                { name: "ダウンロード比率", value: `${(downloadRatio * 100).toFixed(1)}%`, inline: true },
                { name: "分散度スコア (SUM IPs)", value: `${dispersionScore}`, inline: true },
                { name: "IP重複率", value: `${ipRepeatRate.toFixed(2)}`, inline: true },
                { name: "最多Slug集中度", value: `${(topSlugRatio * 100).toFixed(1)}%`, inline: true },
                { name: "検知国数", value: `${approxCountries}`, inline: true },
                { name: "防護適用時間", value: `${protectionDuration / 60000} 分`, inline: true }
              ],
              timestamp: new Date().toISOString()
            }
          ]);

        } else {
          console.error("[DDOS-GUARD] Cloudflare API failure:", apiRes.error);
          // API失敗時は2分間の COOLDOWN に移行してAPI保護
          const cooldownUntil = now + 120000;
          await env.DB.prepare(
            "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, updated_at = ? WHERE state_key = 'global'"
          ).bind(cooldownUntil, now).run();
          
          cachedState = null;

          await sendDdosDiscordNotification(env.DISCORD_WEBHOOK_URL, [
            {
              title: "⚠️ ModParks DDoS Guard エラー通知",
              description: `攻撃を検知しましたが Cloudflare API の呼び出しに失敗しました。APIレート保護のため2分間のCOOLDOWNに入ります。\nエラー内容: \`${apiRes.error}\``,
              color: 0xffaa00,
              timestamp: new Date().toISOString()
            }
          ]);
        }
      }
    }
  } catch (err) {
    console.error("[DDOS-GUARD] Error in evaluateAndTriggerDdos:", err);
  } finally {
    isTransitioning = false;
  }
}

// 統計のフラッシュ
async function flushIsolateStats(env, sliceTime, stats) {
  if (isFlushing) return;
  isFlushing = true;

  try {
    // ON CONFLICT DO UPDATE
    await env.DB.prepare(
      `INSERT INTO ddos_slices (slice_time, isolate_id, request_count, download_count, unique_ip_count, unique_country_count, top_slug, top_slug_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(slice_time, isolate_id) DO UPDATE SET
         request_count = request_count + excluded.request_count,
         download_count = download_count + excluded.download_count,
         unique_ip_count = max(unique_ip_count, excluded.unique_ip_count),
         unique_country_count = max(unique_country_count, excluded.unique_country_count),
         top_slug = CASE WHEN excluded.top_slug_count > top_slug_count THEN excluded.top_slug ELSE top_slug END,
         top_slug_count = max(top_slug_count, excluded.top_slug_count)`
    ).bind(
      sliceTime, ISOLATE_ID, stats.requestCount, stats.downloadCount, stats.uniqueIpCount, stats.uniqueCountryCount, stats.topSlug, stats.topSlugCount
    ).run();

    console.log(`[DDOS-GUARD] Flushed stats for bucket=${sliceTime}: reqs=${stats.requestCount}, dls=${stats.downloadCount}, IPs=${stats.uniqueIpCount}, top=${stats.topSlug}(${stats.topSlugCount})`);
    
    // フラッシュに成功したIsolateのみがその直後に評価を実行する (D1読み込み負荷軽減)
    await evaluateAndTriggerDdos(env, sliceTime);

  } catch (err) {
    console.error("[DDOS-GUARD] Failed to flush stats to D1:", err);
  } finally {
    isFlushing = false;
  }
}

function getAndResetStats() {
  const requestCount = localRequestCount;
  const downloadCount = localDownloadCount;
  const uniqueIpCount = localIPs.size;
  const uniqueCountryCount = localCountries.size;

  let topSlug = null;
  let topSlugCount = 0;
  for (const [slug, count] of Object.entries(localSlugs)) {
    if (count > topSlugCount) {
      topSlug = slug;
      topSlugCount = count;
    }
  }

  // Reset
  localRequestCount = 0;
  localDownloadCount = 0;
  localIPs.clear();
  localCountries.clear();
  localSlugs = {};

  return { requestCount, downloadCount, uniqueIpCount, uniqueCountryCount, topSlug, topSlugCount };
}

// 定期監視とクリーンアップ (毎分Cron)
async function handleDdosCron(controller, env, ctx) {
  const now = Date.now();
  const db = env.DB;
  
  try {
    const state = await getDdosState(db);

    // 1. UNDER_ATTACK 状態で防護期限切れ
    if (state.currentState === "UNDER_ATTACK" && now >= state.scheduledDisableAt) {
      console.log("[DDOS-GUARD] Scheduled disable time reached. Toggling rules to off...");
      
      const lockRes = await db.prepare(
        "UPDATE ddos_state SET current_state = 'DEACTIVATING', updated_at = ? WHERE state_key = 'global' AND current_state = 'UNDER_ATTACK'"
      ).bind(now).run();

      if (lockRes.meta.changes === 1) {
        const apiRes = await toggleDdosProtection(env, false, "");
        if (apiRes.success) {
          const cooldownUntil = now + 300000; // 5分
          await db.prepare(
            "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
          ).bind(cooldownUntil, now, now).run();
          cachedState = null;
          console.log("[DDOS-GUARD] Successfully disabled WAF rule. System is in COOLDOWN");

          const dryLabel = env.DRY_RUN === "true" ? " [DRY-RUN]" : "";
          await sendDdosDiscordNotification(env.DISCORD_WEBHOOK_URL, [
            {
              title: `✅ ModParks DDoS Guard 自動解除${dryLabel}`,
              description: "防護期限（10分〜）が経過したため WAF フィルタを無効化し通常状態へ移行します。\n再発動防止のため、今後5分間はCOOLDOWN（再発動抑制）となります。",
              color: 0x00ff00,
              timestamp: new Date().toISOString()
            }
          ]);
        } else {
          console.error("[DDOS-GUARD] Failed to disable WAF rule:", apiRes.error);
          // API失敗時は次のCronで再試行できるよう UNDER_ATTACK に戻す
          await db.prepare(
            "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', updated_at = ? WHERE state_key = 'global'"
          ).bind(now).run();
          cachedState = null;
        }
      }
    }

    // 2. COOLDOWN 状態で期限切れ
    if (state.currentState === "COOLDOWN" && now >= state.cooldownUntil) {
      console.log("[DDOS-GUARD] Cooldown finished. Reverting state to NORMAL.");
      await db.prepare(
        "UPDATE ddos_state SET current_state = 'NORMAL', last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
      ).bind(now, now).run();
      cachedState = null;
    }

    // 3. ACTIVATING タイムアウト回復 (1分以上経過)
    if (state.currentState === "ACTIVATING" && (now - state.updatedAt >= 60000)) {
      console.warn("[DDOS-GUARD] ACTIVATING timeout detected. Recovering...");
      const currentRuleEnabled = await fetchCurrentWafRuleStatus(env);
      if (currentRuleEnabled === true) {
        // CF側は有効になっていた -> UNDER_ATTACK に移行
        const scheduledDisableAt = now + state.protectionDuration;
        await db.prepare(
          "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', under_attack_enabled_at = ?, scheduled_disable_at = ?, updated_at = ? WHERE state_key = 'global'"
        ).bind(now, scheduledDisableAt, now).run();
        console.log("[DDOS-GUARD] ACTIVATING recovery: CF is active. State moved to UNDER_ATTACK");
      } else {
        // CF側は無効だった -> API失敗とみなし、2分間 COOLDOWN に移行
        const cooldownUntil = now + 120000;
        await db.prepare(
          "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, updated_at = ? WHERE state_key = 'global'"
        ).bind(cooldownUntil, now).run();
        console.log("[DDOS-GUARD] ACTIVATING recovery: CF is inactive. State moved to COOLDOWN");
      }
      cachedState = null;
    }

    // 4. DEACTIVATING タイムアウト回復 (1分以上経過)
    if (state.currentState === "DEACTIVATING" && (now - state.updatedAt >= 60000)) {
      console.warn("[DDOS-GUARD] DEACTIVATING timeout detected. Recovering...");
      const currentRuleEnabled = await fetchCurrentWafRuleStatus(env);
      if (currentRuleEnabled === false) {
        // CF側は無効になっていた -> COOLDOWN に移行
        const cooldownUntil = now + 300000;
        await db.prepare(
          "UPDATE ddos_state SET current_state = 'COOLDOWN', cooldown_until = ?, last_normal_at = ?, updated_at = ? WHERE state_key = 'global'"
        ).bind(cooldownUntil, now, now).run();
        console.log("[DDOS-GUARD] DEACTIVATING recovery: CF is inactive. State moved to COOLDOWN");
      } else {
        // CF側はまだ有効だった -> UNDER_ATTACK に戻して再試行へ
        await db.prepare(
          "UPDATE ddos_state SET current_state = 'UNDER_ATTACK', updated_at = ? WHERE state_key = 'global'"
        ).bind(now).run();
        console.log("[DDOS-GUARD] DEACTIVATING recovery: CF is active. Reverted state to UNDER_ATTACK");
      }
      cachedState = null;
    }

    // 5. 古いスライス (30分前) の DELETE クリーンアップ
    const deleteThreshold = Math.floor(now / 1000) - 1800; // 30分前 (秒)
    const deleteRes = await db.prepare("DELETE FROM ddos_slices WHERE slice_time < ?").bind(deleteThreshold).run();
    if (deleteRes.meta.changes > 0) {
      console.log(`[DDOS-GUARD] Cleaned up ${deleteRes.meta.changes} old statistics slices`);
    }

  } catch (err) {
    console.error("[DDOS-GUARD] Error in handleDdosCron:", err);
  }
}

// ─── Exported Default Handlers ───────────────────────────────────────────────

export default {
  // 元の OpenNext の fetch ハンドラをラップ
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const path = url.pathname;
    const isDownload = path === "/api/download" || path.startsWith("/api/download/");

    try {
      const state = await getDdosState(env.DB);

      // NORMAL の場合のみ、メモリ集計・判定へ
      if (state.currentState === "NORMAL") {
        // クライアントIPの取得
        const ip = req.headers.get("cf-connecting-ip");
        if (ip) {
          const now = Date.now();
          const bucket = Math.floor(now / 10000) * 10; // 10秒バケット
          
          if (currentBucket !== bucket) {
            // バケット境界を跨いだら、未フラッシュの統計があればフラッシュする
            if (localRequestCount > 0) {
              const stats = getAndResetStats();
              ctx.waitUntil(flushIsolateStats(env, currentBucket, stats));
            }
            currentBucket = bucket;
            localRequestCount = 0;
            localDownloadCount = 0;
            localIPs.clear();
            localCountries.clear();
            localSlugs = {};
          }

          // IP集合への追加 (上限1000)
          if (localIPs.size < 1000) {
            localIPs.add(ip);
          }
          
          const country = req.headers.get("cf-ipcountry") || "XX";
          localCountries.add(country);

          localRequestCount++;

          if (isDownload) {
            localDownloadCount++;
            
            // テスト用Isolate偽装ヘッダーの取得 (開発環境限定ガード)
            let currentIsolateId = ISOLATE_ID;
            if (env.ENVIRONMENT === "development" || env.NODE_ENV === "development") {
              const testIsolate = req.headers.get("x-test-isolate-id");
              if (testIsolate) {
                currentIsolateId = testIsolate;
              }
            }

            const slug = url.searchParams.get("slug") || "unknown";
            localSlugs[slug] = (localSlugs[slug] || 0) + 1;

            // 警告閾値: 30リクエスト かつ 前回のフラッシュから5秒以上経過で非同期フラッシュ
            if (localRequestCount >= 30 && (now - lastFlushTime >= 5000)) {
              lastFlushTime = now;
              const stats = getAndResetStats();
              ctx.waitUntil(flushIsolateStats(env, bucket, stats));
            }
          }
        }
      }
    } catch (e) {
      console.error("[DDOS-GUARD] Intercept error:", e);
    }

    // 元の Next.js 処理へフォワード
    return openNextWorker.fetch(req, env, ctx);
  },

  // Cloudflare Cron Triggers 用のハンドラ
  async scheduled(controller, env, ctx) {
    // DDoS用のCronとクリーンアップ処理の実行
    await handleDdosCron(controller, env, ctx);

    // 既存 of Cron routes
    const path = CRON_ROUTES[controller.cron];
    if (path) {
      console.log(`Cron triggered (${controller.cron}): invoking ${path}`);
      await invokeCronRoute(path, env, ctx);
    }
  }
};
