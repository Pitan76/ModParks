/**
 * Cloudflare GraphQL Analytics API からリクエスト数を取得する。
 *
 * ddos_slices は Isolate のメモリ集計を 10 秒ごとに書き出す方式で、
 * 次のリクエストが来ないと最後の分が書き出されない。スパイク検知には十分だが、
 * 「枠をどれだけ消費したか」の会計には少なめに出る。
 * 請求に関わる数値は Cloudflare の実測値を使う。
 *
 * トークンは Account Analytics の読み取りのみで足りる。
 * シークレット書き込み権限を持つ CLOUDFLARE_API_TOKEN は流用しない。
 */

const GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";

/** 1 リクエストで取得する最大日数。日次で回す前提なので小さくてよい */
const MAX_DAYS = 31;

const QUERY = `query WorkerRequests($accountTag: string!, $from: Date!, $to: Date!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(
        limit: ${MAX_DAYS * 100}
        filter: { date_geq: $from, date_leq: $to }
      ) {
        dimensions { date scriptName }
        sum { requests }
      }
    }
  }
}`;

/**
 * ModParks 由来と判定する Worker 名。
 *
 * 枠はアカウント単位なので判定には全スクリプトの合計を使うが、
 * 「自分が何を消費しているか」を分けて見られないと、他プロジェクトが
 * 原因のときに ModParks を止めるという無駄な対処をしてしまう。
 */
const OWN_SCRIPT_PREFIX = "modparks";
const OWN_SCRIPT_EXTRA = new Set(["mp-recipe"]);

function isOwnScript(scriptName: string): boolean {
  if (OWN_SCRIPT_EXTRA.has(scriptName)) return true;
  return scriptName === OWN_SCRIPT_PREFIX || scriptName.startsWith(`${OWN_SCRIPT_PREFIX}-`);
}

/** 1 日ぶんの実測値 */
export type DayRequests = {
  /** アカウント全体。枠の判定に使う */
  total: number;
  /** ModParks 由来のみ。責任範囲の把握に使う */
  own: number;
};

/** 日付 (YYYY-MM-DD) ごとのリクエスト数 */
export type DailyRequests = Map<string, DayRequests>;

type GraphQLResponse = {
  data?: {
    viewer?: {
      accounts?: {
        workersInvocationsAdaptive?: {
          dimensions?: { date?: string; scriptName?: string };
          sum?: { requests?: number };
        }[];
      }[];
    };
  };
  errors?: { message?: string }[];
};

type AnalyticsEnv = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ANALYTICS_TOKEN?: string;
};

/** Workers 本番では secret がバインディング env 側にあるため、process.env だけでは取れない */
async function resolveEnv(): Promise<AnalyticsEnv> {
  const fromProcess = process.env as unknown as AnalyticsEnv;
  if (fromProcess.CLOUDFLARE_ANALYTICS_TOKEN) return fromProcess;

  try {
    if (process.env.NODE_ENV === "development" && process.release?.name === "node") {
      const { getCachedPlatformProxy } = await import("@/lib/proxy");
      return (await getCachedPlatformProxy()).env as unknown as AnalyticsEnv;
    }

    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as AnalyticsEnv;
  } catch (err) {
    console.error("[USAGE] Failed to resolve analytics env:", err);
    return {};
  }
}

/** アカウント全体の合計と、ModParks 由来の内訳を日ごとに畳む */
function toDailyTotals(response: GraphQLResponse): DailyRequests {
  const totals: DailyRequests = new Map();
  const rows = response.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];

  for (const row of rows) {
    const date = row.dimensions?.date;
    if (!date) continue;

    const requests = row.sum?.requests ?? 0;
    const current = totals.get(date) ?? { total: 0, own: 0 };
    current.total += requests;
    if (isOwnScript(row.dimensions?.scriptName ?? "")) current.own += requests;
    totals.set(date, current);
  }

  return totals;
}

/**
 * 期間内の日次リクエスト数を取得する。
 *
 * @param from 開始日 (YYYY-MM-DD, UTC)
 * @param to   終了日 (YYYY-MM-DD, UTC)
 * @returns 取得できなければ null。トークン未設定と取得失敗を区別しない
 *   （どちらも「Cloudflare の実測値が無い」として扱えば足りる）
 */
export async function fetchDailyRequests(from: string, to: string): Promise<DailyRequests | null> {
  const env = await resolveEnv();
  const accountTag = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!accountTag || !token) return null;

  // 外部 API 境界。失敗しても利用量の集計そのものは続ける
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: QUERY, variables: { accountTag, from, to } }),
    });

    const body = (await res.json()) as GraphQLResponse;
    if (body.errors?.length) {
      console.error("[USAGE] Analytics API returned errors:", body.errors.map((e) => e.message).join(", "));
      return null;
    }
    if (!res.ok) {
      console.error("[USAGE] Analytics API failed:", res.status);
      return null;
    }

    return toDailyTotals(body);
  } catch (err) {
    console.error("[USAGE] Analytics API request failed:", err);
    return null;
  }
}
