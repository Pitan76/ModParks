/** WAFルールを無効化するときに使う、決して一致しないダミー式 */
const NEVER_MATCH_EXPRESSION = `(http.request.uri.path eq "/dev/null")`;

function hasWafConfig(env) {
  return Boolean(env.CF_WAF_API_TOKEN && env.CF_ZONE_ID && env.CF_RULESET_ID && env.CF_WAF_RULE_ID);
}

function buildRuleUrl(env) {
  return `https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/rulesets/${env.CF_RULESET_ID}/rules/${env.CF_WAF_RULE_ID}`;
}

/**
 * WAF の match 式を組み立てる。
 * slug を式へ直接埋め込むため、allowlist を満たさない場合は絞り込みを諦めてパス全体を対象にする。
 */
function buildExpression(enable, topSlug) {
  const isSafeSlug = topSlug && /^[a-z0-9-]{1,64}$/.test(topSlug);
  if (enable && isSafeSlug) {
    return `(http.request.uri.path contains "/api/download" and http.request.uri.args["slug"][0] eq "${topSlug}")`;
  }
  return `(http.request.uri.path contains "/api/download")`;
}

/**
 * Cloudflare の WAF カスタムルール（Rulesets API）を切り替える。
 * @param topSlug 攻撃が集中しているプロジェクト。指定するとそのプロジェクトのみを対象にする
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function toggleDdosProtection(env, enable, topSlug) {
  const isDryRun = env.DRY_RUN === "true";
  console.log(`[DDOS-GUARD] toggleDdosProtection: enable=${enable}, topSlug=${topSlug}, dryRun=${isDryRun}`);

  if (isDryRun) return { success: true };

  if (!hasWafConfig(env)) {
    console.error("[DDOS-GUARD] Missing Cloudflare API configuration environment variables");
    return { success: false, error: "Missing config" };
  }

  const body = enable
    ? { enabled: true, expression: buildExpression(true, topSlug), action: "managed_challenge" }
    : { enabled: false, expression: NEVER_MATCH_EXPRESSION, action: "managed_challenge" };

  // 外部APIの失敗はリクエスト処理を止める理由にならないので、結果に畳み込んで返す
  try {
    const res = await fetch(buildRuleUrl(env), {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${env.CF_WAF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.errors ? JSON.stringify(data.errors) : `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 現在のWAFルールが有効かを Cloudflare から取得する。
 * 状態遷移が途中で落ちた場合に、CF側とD1のどちらが正しいかを判断するために使う。
 * @returns {Promise<boolean|null>} 取得できなければ null
 */
export async function fetchCurrentWafRuleStatus(env) {
  if (!hasWafConfig(env)) return null;

  try {
    const res = await fetch(buildRuleUrl(env), {
      method: "GET",
      headers: { "Authorization": `Bearer ${env.CF_WAF_API_TOKEN}` },
    });
    const data = await res.json();
    if (res.ok && data.success && data.result) return data.result.enabled;
  } catch (e) {
    console.error("[DDOS-GUARD] fetchWafStatus failed:", e);
  }
  return null;
}
