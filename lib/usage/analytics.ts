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

import {
  truncateDetail,
  type AnalyticsFailure,
  type AnalyticsFailureKind,
} from "@/lib/usage/analyticsStatus";

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
  errors?: { message?: string; path?: string[]; extensions?: { code?: string } }[];
};

type AnalyticsEnv = {
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ANALYTICS_TOKEN?: string;
};

/** 取得できなかった理由を握りつぶさずに返す */
export type AnalyticsResult =
  | { ok: true; data: DailyRequests }
  | { ok: false; failure: AnalyticsFailure };

function fail(kind: AnalyticsFailureKind, detail?: string, status?: number): AnalyticsResult {
  const failure: AnalyticsFailure = { kind, ...(detail ? { detail: truncateDetail(detail) } : {}), ...(status ? { status } : {}) };
  console.error("[USAGE] Analytics unavailable:", failure);
  return { ok: false, failure };
}

/** Workers 本番では secret がバインディング env 側にあるため、process.env だけでは取れない */
async function resolveEnv(): Promise<AnalyticsEnv | { error: string }> {
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
    return { error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) };
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
 * @returns 成功なら日次の実測値。失敗時は理由を添えて返し、呼び出し元が記録できるようにする
 */
export async function fetchDailyRequests(from: string, to: string): Promise<AnalyticsResult> {
  const env = await resolveEnv();
  if ("error" in env) return fail("envUnavailable", env.error);

  const accountTag = env.CLOUDFLARE_ACCOUNT_ID;
  const token = env.CLOUDFLARE_ANALYTICS_TOKEN;
  if (!accountTag) return fail("missingAccountId");
  if (!token) return fail("missingToken");

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

    // GraphQL 以外のエラー（認証失敗など）は JSON ですらないことがある
    const text = await res.text();
    const body = parseBody(text);
    if (!body) return fail("httpError", text, res.status);
    if (body.errors?.length) return fail("graphqlErrors", formatGraphQLErrors(body.errors), res.status);
    if (!res.ok) return fail("httpError", text, res.status);

    return { ok: true, data: toDailyTotals(body) };
  } catch (err) {
    return fail("networkError", err instanceof Error ? `${err.name}: ${err.message}` : String(err));
  }
}

function parseBody(text: string): GraphQLResponse | null {
  try {
    return JSON.parse(text) as GraphQLResponse;
  } catch {
    return null;
  }
}

/** message だけだと権限名などが落ちるため、コードやパスも残す */
function formatGraphQLErrors(errors: NonNullable<GraphQLResponse["errors"]>): string {
  return errors
    .map((e) => {
      const code = e.extensions?.code;
      const path = e.path?.join(".");
      const suffix = [code && `code=${code}`, path && `path=${path}`].filter(Boolean).join(" ");
      return suffix ? `${e.message ?? "unknown error"} (${suffix})` : (e.message ?? "unknown error");
    })
    .join(" / ");
}
