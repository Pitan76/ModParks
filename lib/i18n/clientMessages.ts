import type { AbstractIntlMessages } from "next-intl";

/**
 * クライアントへ配る翻訳メッセージの絞り込み。
 *
 * NextIntlClientProvider に渡した messages は RSC ペイロードにそのまま乗る。
 * 全量を渡すと、管理画面や設定画面でしか使わない文言（ja で合計 18KB 超、全体の約 4 割）が
 * トップページを開いただけの閲覧者にも毎回転送される。ここで送る範囲を決める。
 *
 * サーバコンポーネントの getTranslations() はこの絞り込みの影響を受けない。
 * サーバ側では常に全量を参照できるため、減るのはクライアントへの転送分だけ。
 *
 * 注意: 入れ子の NextIntlClientProvider は messages をマージせず「置換」する
 * （use-intl の IntlProvider は親の messages を子の messages で丸ごと差し替える）。
 * そのため管理画面用・設定画面用は、共通分を含めた完成形を組み立てて渡す必要がある。
 */

/** クライアントコンポーネントから参照されないネームスペース。サーバ側でしか使わない */
const SERVER_ONLY_NAMESPACES = ["Legal"] as const;

/**
 * サイドバーが必要とする見出しだけを抜き出す。
 *
 * AdminSidebar / SettingsSidebar は AppLayout（ルートレイアウト配下）から描画されるため、
 * 管理画面・設定画面の「外」にいる間もラベルを引ける必要がある。
 * 一方でネームスペース全体を配る必要は無いので、サイドバーが実際に使う枝だけを残す。
 */
function pickBranch(source: AbstractIntlMessages, keys: readonly string[]): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) picked[key] = value;
  }
  return picked;
}

/** SettingsSidebar が引く見出しキー。各セクションの title だけを残す */
const SETTINGS_SIDEBAR_SECTIONS = [
  "account",
  "apiKeys",
  "integration",
  "notifications",
  "posting",
  "profile",
  "rewards",
  "security",
  "theme",
] as const;

/** 設定画面の外から参照される Settings の枝（セクション見出しのみ） */
function pickSettingsSidebar(settings: AbstractIntlMessages): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const section of SETTINGS_SIDEBAR_SECTIONS) {
    const value = settings[section] as AbstractIntlMessages | undefined;
    if (value?.title !== undefined) picked[section] = { title: value.title };
  }
  return picked;
}

function omitServerOnly(messages: AbstractIntlMessages): AbstractIntlMessages {
  const rest = { ...messages };
  for (const namespace of SERVER_ONLY_NAMESPACES) delete rest[namespace];
  return rest;
}

/**
 * ルートレイアウトでクライアントへ配る分。
 * Admin / Settings はサイドバーが使う枝だけに縮める。
 */
export function pickRootMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const rest = omitServerOnly(messages);
  const admin = messages.Admin as AbstractIntlMessages | undefined;
  const settings = messages.Settings as AbstractIntlMessages | undefined;

  if (admin) rest.Admin = pickBranch(admin, ["sidebar"]);
  if (settings) rest.Settings = pickSettingsSidebar(settings);

  return rest;
}

/** 管理画面配下。ルート共通分に Admin 全量を戻す */
export function pickAdminMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return { ...pickRootMessages(messages), Admin: messages.Admin };
}

/** 設定画面配下。ルート共通分に Settings 全量を戻す */
export function pickSettingsMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  return { ...pickRootMessages(messages), Settings: messages.Settings };
}
