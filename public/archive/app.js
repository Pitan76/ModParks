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

function projectCard(project) {
  const card = el("a", "card");
  card.href = "#/projects/" + encodeURIComponent(project.slug);

  if (project.iconUrl) {
    const icon = el("img", "icon");
    icon.src = project.iconUrl;
    icon.alt = "";
    icon.loading = "lazy";
    card.appendChild(icon);
  }

  const body = el("div", "card-body");
  body.appendChild(el("div", "card-title", project.title));
  body.appendChild(el("div", "card-meta", project.authorName));
  body.appendChild(el("div", "card-meta", t("downloads") + ": " + project.downloads.toLocaleString()));
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

  const grid = el("div", "grid");
  for (const project of matched) grid.appendChild(projectCard(project));
  view.appendChild(grid);
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
  view.appendChild(el("h1", "title", project.title));

  const meta = el("dl", "meta");
  const authorLink = el("a", null, project.authorName);
  authorLink.href = "#/authors/" + encodeURIComponent(project.authorName);
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

  const grid = el("div", "grid");
  for (const slug of author.projectSlugs) {
    const summary = summaries.find((p) => p.slug === slug);
    if (summary) grid.appendChild(projectCard(summary));
  }
  view.appendChild(grid);
}

async function route() {
  const target = currentRoute();
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

  document.getElementById("q").addEventListener("input", (e) => {
    if (currentRoute().kind === "list") renderList(e.target.value);
  });
  window.addEventListener("hashchange", route);

  await route();
}

boot();
