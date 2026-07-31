/**
 * Google Charts ローダー。
 *
 * npm パッケージではなく gstatic のローダーを使うため、
 * script/style の許可ホストを next.config.ts の CSP に入れてある。
 */

const LOADER_SRC = "https://www.gstatic.com/charts/loader.js";

export type GoogleChartType = "AreaChart" | "ColumnChart" | "BarChart";

type ChartInstance = {
  draw(data: object, options: object): void;
};

type GoogleChartsApi = {
  charts: {
    load(version: string, options: { packages: string[]; language?: string }): void;
    setOnLoadCallback(callback: () => void): void;
  };
  visualization: Record<GoogleChartType, new (container: Element) => ChartInstance> & {
    arrayToDataTable(rows: unknown[][]): object;
  };
};

declare global {
  interface Window {
    google?: GoogleChartsApi;
  }
}

/** 複数のグラフが同時に描画されてもローダーは 1 度しか読み込まない */
let loading: Promise<GoogleChartsApi> | null = null;

function injectLoader(): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${LOADER_SRC}"]`);
  if (existing) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Charts"));
    document.head.appendChild(script);
  });
}

/** corechart パッケージの読み込み完了を待って API を返す */
export function loadGoogleCharts(language: string): Promise<GoogleChartsApi> {
  if (loading) return loading;

  loading = injectLoader().then(
    () =>
      new Promise<GoogleChartsApi>((resolve) => {
        const google = window.google!;
        google.charts.load("current", { packages: ["corechart"], language });
        google.charts.setOnLoadCallback(() => resolve(google));
      })
  );

  return loading;
}
