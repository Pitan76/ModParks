/**
 * 読み取り専用アーカイブの描画。
 *
 * 本体の Next.js とはコードを共用しない。共用すると本体のビルド変更で壊れ、
 * しかも壊れたことに気づくのが障害時になる。ここは依存ゼロで動かす。
 *
 * 入り口は 3 通りある（SEC-2.md 参照）。
 *   - modparks.pitan76.net/archive   平常時。ハッシュで辿る
 *   - modparks.pitan76.net/...       Level 2。Static Assets のフォールバック
 *   - archive.modparks.pitan76.net   R2 直配信。ハッシュで辿る
 */

/** データの配信元。archive ホストから開いたときは同一オリジンを使う */
function dataBase() {
  if (location.hostname.startsWith("archive.")) return "/v1";

  const meta = document.querySelector('meta[name="mp-data-origin"]');
  return (meta ? meta.content : "") + "/v1";
}

const BASE = dataBase();
const view = document.getElementById("view");

let strings = {};
let manifest = null;
let summaries = null;

function t(key, params) {
  const template = strings[key] || key;
  if (!params) return template;

  return Object.keys(params).reduce(
    (text, name) => text.replace("{" + name + "}", params[name]),
    template
  );
}

/** テキストは必ずここを通す。innerHTML に値を差し込まない */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

async function getJson(path) {
  const res = await fetch(BASE + path, { cache: "no-cache" });
  if (!res.ok) throw new Error(path + ": " + res.status);
  return res.json();
}

/** 現在のルート。パスを優先し、無ければハッシュを見る */
function currentRoute() {
  const fromPath = location.pathname.match(/^\/(projects|authors)\/([^/]+)/);
  if (fromPath) return { kind: fromPath[1], id: decodeURIComponent(fromPath[2]) };

  const fromHash = location.hash.match(/^#\/(projects|authors)\/([^/]+)/);
  if (fromHash) return { kind: fromHash[1], id: decodeURIComponent(fromHash[2]) };

  return { kind: "list" };
}

/** 日付は端末の書式に任せる。翻訳を増やさずに読める形になる */
function formatDate(ms) {
  return new Date(ms).toLocaleDateString();
}

/**
 * 一覧カード。本体の ProjectCard と同じ構成にする。
 * アイコン / タイトル + 種別 / 説明2行 / 作者・日付・DL数。
 */
function projectCard(project) {
  const card = el("a", "card");
  card.href = "#/projects/" + encodeURIComponent(project.slug);

  const icon = el("div", "icon");
  if (project.iconUrl) {
    const img = el("img");
    img.src = project.iconUrl;
    img.alt = "";
    img.loading = "lazy";
    icon.appendChild(img);
  } else {
    icon.classList.add("icon-empty");
  }
  card.appendChild(icon);

  const body = el("div", "card-body");

  const head = el("div", "card-head");
  head.appendChild(el("span", "card-title", project.title));
  head.appendChild(el("span", "badge badge-" + project.type, project.type));
  body.appendChild(head);

  if (project.excerpt) body.appendChild(el("p", "card-desc", project.excerpt));

  const meta = el("div", "card-meta");
  meta.appendChild(el("span", null, "by " + project.authorName));
  meta.appendChild(el("span", "dot", "·"));
  meta.appendChild(el("span", null, formatDate(project.updatedAt)));
  meta.appendChild(el("span", "dot", "·"));
  meta.appendChild(el("span", null, project.downloads.toLocaleString() + " " + t("downloads")));
  body.appendChild(meta);

  card.appendChild(body);
  return card;
}

function renderList(query) {
  const needle = (query || "").trim().toLowerCase();
  const matched = needle
    ? summaries.filter((p) =>
        p.title.toLowerCase().includes(needle) || p.authorName.toLowerCase().includes(needle))
    : summaries;

  view.replaceChildren();
  if (matched.length === 0) {
    view.appendChild(el("p", "empty", t("empty")));
    return;
  }

  const list = el("div", "list");
  for (const project of matched) list.appendChild(projectCard(project));
  view.appendChild(list);
}

function definition(label, value) {
  const row = el("div", "def");
  row.appendChild(el("dt", null, label));
  row.appendChild(el("dd", null, value));
  return row;
}

function versionRow(version) {
  const row = el("li", "version");
  row.appendChild(el("span", "vnum", version.versionNumber));
  row.appendChild(el("span", "vmeta", version.mcVersions.join(", ")));
  row.appendChild(el("span", "vmeta", version.loaders.join(", ")));

  if (version.externalUrl) {
    const link = el("a", "vlink", t("externalDownload"));
    link.href = version.externalUrl;
    link.rel = "noopener";
    row.appendChild(link);
  }
  return row;
}

async function renderProject(slug) {
  const project = await getJson("/projects/" + encodeURIComponent(slug) + ".json");

  view.replaceChildren();

  const head = el("div", "detail-head");
  head.appendChild(el("h1", "title", project.title));
  head.appendChild(el("span", "badge badge-" + project.type, project.type));
  view.appendChild(head);

  const meta = el("dl", "meta");
  meta.appendChild(definition(t("author"), project.authorName));
  meta.appendChild(definition(t("license"), project.license));
  meta.appendChild(definition(t("downloads"), project.downloads.toLocaleString()));
  view.appendChild(meta);

  // README は Markdown だが、変換器を積むと依存が増えるため整形済みテキストとして出す
  view.appendChild(el("pre", "body", project.body));

  view.appendChild(el("h2", "sub", t("versions")));
  if (project.versions.length === 0) {
    view.appendChild(el("p", "empty", t("noVersions")));
    return;
  }

  const list = el("ul", "versions");
  for (const version of project.versions) list.appendChild(versionRow(version));
  view.appendChild(list);
}

async function renderAuthor(username) {
  const author = await getJson("/authors/" + encodeURIComponent(username) + ".json");

  view.replaceChildren();
  view.appendChild(el("h1", "title", t("projectsBy", { name: author.displayName })));

  const list = el("div", "list");
  for (const slug of author.projectSlugs) {
    const summary = summaries.find((p) => p.slug === slug);
    if (summary) list.appendChild(projectCard(summary));
  }
  view.appendChild(list);
}

/** サイドバーの選択状態を本体と同じ見た目で反映する */
function syncNav(kind) {
  for (const item of document.querySelectorAll(".nav-item")) {
    item.classList.toggle("selected", item.dataset.route === kind);
  }
}

async function route() {
  const target = currentRoute();
  syncNav(target.kind === "list" ? "list" : "projects");
  document.getElementById("sidebar").classList.remove("open");
  view.replaceChildren(el("p", "empty", t("loading")));

  try {
    if (target.kind === "projects") return await renderProject(target.id);
    if (target.kind === "authors") return await renderAuthor(target.id);
    renderList(document.getElementById("q").value);
  } catch (err) {
    console.error(err);
    view.replaceChildren(el("p", "empty", t("notFound")));
  }
}

async function boot() {
  const lang = (navigator.language || "en").toLowerCase().startsWith("ja") ? "ja" : "en";
  strings = (await fetch("./strings.json").then((r) => r.json()))[lang];

  const notice = document.getElementById("notice");
  notice.textContent = t("readOnlyNotice");
  notice.hidden = false;
  document.getElementById("q").placeholder = t("searchPlaceholder");
  document.getElementById("mainSite").textContent = t("backToMain");

  try {
    manifest = await getJson("/manifest.json");
    summaries = await getJson("/projects.json");
  } catch (err) {
    console.error(err);
    view.replaceChildren(el("p", "empty", t("loadFailed")));
    return;
  }

  document.getElementById("generated").textContent =
    t("generatedAt", { at: new Date(manifest.generatedAt).toISOString().slice(0, 16).replace("T", " ") });

  document.getElementById("navHome").textContent = t("navHome");
  document.getElementById("navProjects").textContent = t("navProjects");
  document.getElementById("sidebarNote").textContent = t("sidebarNote");

  document.getElementById("menu").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  document.getElementById("q").addEventListener("input", (e) => {
    if (currentRoute().kind === "list") renderList(e.target.value);
  });
  window.addEventListener("hashchange", route);

  await route();
}

boot();
